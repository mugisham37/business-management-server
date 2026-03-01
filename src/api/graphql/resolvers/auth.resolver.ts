import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from './base.resolver';
import { AuthService } from '../../../modules/auth/auth.service';
import { UserService } from '../../../modules/user/user.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../../../modules/auth/decorators/public.decorator';
import { OrganizationType } from '@prisma/client';
import {
  AuthResponse,
  RegisterOwnerInput,
  LoginInput,
  LoginWithPinInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from '../types/auth.type';
import { RequestContext } from '../../../common/types/user-context.type';

/**
 * AuthResolver
 *
 * Handles GraphQL mutations for authentication operations including:
 * - Owner registration
 * - Login (email/password and PIN)
 * - Logout
 * - Token refresh
 * - Password change
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 14.4
 */
@Resolver()
export class AuthResolver extends BaseResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {
    super('AuthResolver');
  }

  /**
   * Register new organization owner
   *
   * Requirement 1.1, 1.2: Create organization and owner user with full permissions
   *
   * @param input - Owner registration data
   * @param context - GraphQL context with request information
   * @returns Authentication response with tokens
   */
  @Public()
  @Mutation(() => AuthResponse, { name: 'registerOwner' })
  async registerOwner(
    @Args('input') input: RegisterOwnerInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    this.logOperation('registerOwner', { email: input.email });

    const requestContext = this.extractRequestContext(context);

    const result = await this.authService.registerOwner(
      {
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        organizationName: input.organizationName,
        organizationType: input.organizationType as OrganizationType,
        organizationSettings: input.organizationSettings
          ? JSON.parse(input.organizationSettings)
          : undefined,
      },
      requestContext,
    );

    return result;
  }

  /**
   * Login with email and password
   *
   * Requirement 2.1: Validate credentials and return JWT tokens
   *
   * @param input - Login credentials
   * @param context - GraphQL context with request information
   * @returns Authentication response with tokens
   */
  @Public()
  @Mutation(() => AuthResponse, { name: 'login' })
  async login(
    @Args('input') input: LoginInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    this.logOperation('login', { email: input.email });

    const requestContext = this.extractRequestContext(context);

    const result = await this.authService.loginWithPassword(
      input.email,
      input.password,
      input.organizationId,
      requestContext,
    );

    return result;
  }

  /**
   * Login with PIN (workers only)
   *
   * Requirement 2.2: Validate PIN and return JWT tokens for workers
   *
   * @param input - PIN login credentials
   * @param context - GraphQL context with request information
   * @returns Authentication response with tokens
   */
  @Public()
  @Mutation(() => AuthResponse, { name: 'loginWithPin' })
  async loginWithPin(
    @Args('input') input: LoginWithPinInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    this.logOperation('loginWithPin', { email: input.email });

    const requestContext = this.extractRequestContext(context);

    const result = await this.authService.loginWithPin(
      input.email,
      input.pin,
      input.organizationId,
      requestContext,
    );

    return result;
  }

  /**
   * Logout and revoke session
   *
   * Requirement 2.4: Revoke session and blacklist access token
   *
   * @param currentUser - Current authenticated user
   * @param context - GraphQL context with request information
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'logout' })
  async logout(
    @GqlCurrentUser() currentUser: any,
    @Context() context: any,
  ): Promise<boolean> {
    this.logOperation('logout', { userId: currentUser.userId });

    const accessToken = this.extractAccessToken(context);
    const sessionId = currentUser.sessionId || '';

    await this.authService.logout(
      currentUser.userId,
      sessionId,
      accessToken,
    );

    return true;
  }

  /**
   * Refresh access token using refresh token
   *
   * Requirement 3.3, 3.4: Validate refresh token and issue new tokens with rotation
   *
   * @param input - Refresh token
   * @param context - GraphQL context with request information
   * @returns Authentication response with new tokens
   */
  @Public()
  @Mutation(() => AuthResponse, { name: 'refreshToken' })
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    this.logOperation('refreshToken');

    // TODO: Implement refreshAccessToken in TokenService
    // For now, throw an error indicating it's not yet implemented
    throw new Error(
      'Token refresh is not yet implemented. Please implement refreshAccessToken in TokenService.',
    );
  }

  /**
   * Change user password
   *
   * Requirement 14.4: Change password with current password verification
   * Requirement 14.5: Revoke all sessions except current on password change
   *
   * @param input - Password change data
   * @param currentUser - Current authenticated user
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'changePassword' })
  async changePassword(
    @Args('input') input: ChangePasswordInput,
    @GqlCurrentUser() currentUser: any,
  ): Promise<boolean> {
    this.logOperation('changePassword', { userId: currentUser.userId });

    await this.userService.changePassword(
      currentUser.userId,
      input.currentPassword,
      input.newPassword,
    );

    return true;
  }

  /**
   * Extract request context from GraphQL context
   *
   * @param context - GraphQL context
   * @returns Request context with IP and user agent
   */
  private extractRequestContext(context: any): RequestContext {
    const req = context.req;
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  }

  /**
   * Extract access token from GraphQL context
   *
   * @param context - GraphQL context
   * @returns Access token string
   */
  private extractAccessToken(context: any): string {
    const req = context.req;
    const authHeader = req.headers.authorization || '';
    return authHeader.replace('Bearer ', '');
  }
}
