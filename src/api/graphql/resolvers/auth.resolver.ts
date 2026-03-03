import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from './base.resolver';
import { AuthService } from '../../../modules/auth/auth.service';
import { UserService } from '../../../modules/user/user.service';
import { SessionService } from '../../../modules/auth/session.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { RateLimitGuard } from '../../../modules/auth/guards/rate-limit.guard';
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
  SessionType,
  RevokeSessionInput,
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
    private readonly sessionService: SessionService,
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
   * Requirement 2.9, 17.1: Rate limiting applied (5 attempts per 15 minutes)
   *
   * @param input - Login credentials
   * @param context - GraphQL context with request information
   * @returns Authentication response with tokens
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @Mutation(() => AuthResponse, { name: 'login' })
  async login(
    @Args('input') input: LoginInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    this.logOperation('login', { email: input.email, organizationName: input.organizationName });

    const requestContext = this.extractRequestContext(context);

    const result = await this.authService.loginWithPassword(
      input.email,
      input.organizationName,
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
   * Requirement 2.9, 17.1: Rate limiting applied (5 attempts per 15 minutes)
   *
   * @param input - PIN login credentials
   * @param context - GraphQL context with request information
   * @returns Authentication response with tokens
   */
  @Public()
  @UseGuards(RateLimitGuard)
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

    const result = await this.authService.refreshToken(input.refreshToken);

    return result;
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

  /**
   * Get active sessions for current user
   *
   * Requirement 13.5: Allow users to view all active sessions
   *
   * @param currentUser - Current authenticated user
   * @returns Array of active sessions
   */
  @UseGuards(GqlAuthGuard)
  @Query(() => [SessionType], { name: 'getActiveSessions' })
  async getActiveSessions(
    @GqlCurrentUser() currentUser: any,
  ): Promise<SessionType[]> {
    this.logOperation('getActiveSessions', { userId: currentUser.userId });

    const sessions = await this.sessionService.getActiveSessions(
      currentUser.userId,
    );

    // Map to GraphQL type, excluding sensitive fields
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress || 'unknown',
      userAgent: session.userAgent || 'unknown',
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));
  }

  /**
   * Revoke a specific session
   *
   * Requirement 13.6: Allow users to revoke specific sessions
   *
   * @param input - Session ID to revoke
   * @param currentUser - Current authenticated user
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'revokeSession' })
  async revokeSession(
    @Args('input') input: RevokeSessionInput,
    @GqlCurrentUser() currentUser: any,
  ): Promise<boolean> {
    this.logOperation('revokeSession', {
      userId: currentUser.userId,
      sessionId: input.sessionId,
    });

    // Verify the session belongs to the current user
    const sessions = await this.sessionService.getActiveSessions(
      currentUser.userId,
    );
    const sessionExists = sessions.some((s) => s.id === input.sessionId);

    if (!sessionExists) {
      throw new Error('Session not found or already revoked');
    }

    await this.sessionService.revokeSession(input.sessionId);

    return true;
  }

  /**
   * Revoke all sessions except the current one
   *
   * Requirement 13.6: Allow users to revoke all sessions except current
   *
   * @param currentUser - Current authenticated user
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean, { name: 'revokeAllSessions' })
  async revokeAllSessions(
    @GqlCurrentUser() currentUser: any,
  ): Promise<boolean> {
    this.logOperation('revokeAllSessions', { userId: currentUser.userId });

    const currentSessionId = currentUser.sessionId || '';

    await this.sessionService.revokeAllUserSessions(
      currentUser.userId,
      currentSessionId,
    );

    return true;
  }
}
