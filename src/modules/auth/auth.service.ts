import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import * as bcrypt from 'bcrypt';
import { HierarchyLevel, UserStatus } from '@prisma/client';
import { RequestContext } from '../../common/types/user-context.type';

/**
 * Response returned after successful authentication
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    hierarchyLevel: HierarchyLevel;
    organizationId: string;
  };
  expiresIn: number;
}

/**
 * AuthService
 *
 * Handles user authentication across multiple methods (email/password, PIN, Google OAuth).
 * Implements account locking, failed login tracking, and session management.
 *
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 10;
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Login with email and password
   *
   * Requirement 2.1: Validate credentials using bcrypt, check account status,
   * and return JWT tokens
   *
   * @param email - User email
   * @param password - User password
   * @param organizationId - Organization ID
   * @param context - Request context (IP, user agent)
   * @returns Authentication response with tokens
   */
  async loginWithPassword(
    email: string,
    password: string,
    organizationId: string,
    context: RequestContext,
  ): Promise<AuthResponse> {
    this.logger.debug(`Login attempt for email: ${email}`);

    // Validate user credentials and account status
    const user = await this.validateUser(email, password, organizationId);

    if (!user) {
      // Increment failed attempts for the user if found
      const existingUser = await this.prisma.users.findUnique({
        where: {
          email_organizationId: {
            email,
            organizationId,
          },
        },
      });

      if (existingUser) {
        await this.handleFailedLogin(existingUser.id);
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.resetFailedAttempts(user.id);

    // Generate tokens and create session
    return this.createAuthResponse(user, context);
  }

  /**
   * Login with PIN for workers
   *
   * Requirement 2.2: Validate 4-6 digit PIN using bcrypt, verify hierarchyLevel=WORKER,
   * and return JWT tokens
   *
   * @param email - User email
   * @param pin - User PIN
   * @param organizationId - Organization ID
   * @param context - Request context (IP, user agent)
   * @returns Authentication response with tokens
   */
  async loginWithPin(
    email: string,
    pin: string,
    organizationId: string,
    context: RequestContext,
  ): Promise<AuthResponse> {
    this.logger.debug(`PIN login attempt for email: ${email}`);

    // Find user
    const user = await this.prisma.users.findUnique({
      where: {
        email_organizationId: {
          email,
          organizationId,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify user is a worker
    if (user.hierarchyLevel !== HierarchyLevel.WORKER) {
      this.logger.warn(
        `PIN login attempted by non-worker user: ${user.id}`,
      );
      throw new UnauthorizedException('PIN login is only available for workers');
    }

    // Check if PIN is set
    if (!user.pinHash) {
      throw new UnauthorizedException('PIN not set for this user');
    }

    // Check account status
    await this.checkAccountStatus(user);

    // Validate PIN
    const isPinValid = await bcrypt.compare(pin, user.pinHash);

    if (!isPinValid) {
      await this.handleFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.resetFailedAttempts(user.id);

    // Generate tokens and create session
    return this.createAuthResponse(user, context);
  }

  /**
   * Validate user credentials and check account status
   *
   * Requirement 2.1: Validate credentials using bcrypt and check account status
   * (not LOCKED, not INACTIVE)
   *
   * @param email - User email
   * @param password - User password
   * @param organizationId - Organization ID
   * @returns User if valid, null otherwise
   */
  async validateUser(
    email: string,
    password: string,
    organizationId: string,
  ): Promise<any | null> {
    this.logger.debug(`Validating user: ${email}`);

    // Find user by email and organization
    const user = await this.prisma.users.findUnique({
      where: {
        email_organizationId: {
          email,
          organizationId,
        },
      },
    });

    if (!user) {
      this.logger.debug(`User not found: ${email}`);
      return null;
    }

    // Check if password is set
    if (!user.passwordHash) {
      this.logger.warn(`User ${user.id} has no password set`);
      return null;
    }

    // Check account status
    try {
      await this.checkAccountStatus(user);
    } catch (error) {
      this.logger.debug(`Account status check failed for user ${user.id}`);
      throw error;
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.debug(`Invalid password for user: ${email}`);
      return null;
    }

    this.logger.debug(`User validated successfully: ${email}`);
    return user;
  }

  /**
   * Handle failed login attempts and account locking
   *
   * Requirement 2.6: Increment failedLoginAttempts on failed login
   * Requirement 2.7: Lock account after 5 failed attempts for 30 minutes
   *
   * @param userId - User ID
   */
  async handleFailedLogin(userId: string): Promise<void> {
    this.logger.debug(`Handling failed login for user: ${userId}`);

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return;
    }

    const newFailedAttempts = user.failedLoginAttempts + 1;

    // Check if account should be locked
    if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(
        lockedUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES,
      );

      await this.prisma.users.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: newFailedAttempts,
          status: UserStatus.LOCKED,
          lockedUntil,
        },
      });

      this.logger.warn(
        `Account locked for user ${userId} until ${lockedUntil.toISOString()}`,
      );
    } else {
      await this.prisma.users.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: newFailedAttempts,
        },
      });

      this.logger.debug(
        `Failed login attempts for user ${userId}: ${newFailedAttempts}`,
      );
    }
  }

  /**
   * Reset failed login attempts
   *
   * Requirement 2.5: Reset failedLoginAttempts to 0 on successful login
   *
   * @param userId - User ID
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    this.logger.debug(`Resetting failed attempts for user: ${userId}`);

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    this.logger.debug(`Failed attempts reset for user: ${userId}`);
  }

  /**
   * Logout and revoke session
   *
   * Requirement 2.4: Revoke session and add access token to blacklist
   *
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param accessToken - Access token to blacklist
   */
  async logout(
    userId: string,
    sessionId: string,
    accessToken: string,
  ): Promise<void> {
    this.logger.debug(`Logout for user ${userId}, session ${sessionId}`);

    // Revoke the session
    await this.sessionService.revokeSession(sessionId);

    // Add access token to blacklist
    await this.tokenService.revokeToken(accessToken);

    this.logger.log(`User ${userId} logged out successfully`);
  }

  /**
   * Check account status and handle automatic unlocking
   *
   * Requirement 2.8: Automatically allow login attempts when lockedUntil time passes
   *
   * @param user - User object
   * @throws UnauthorizedException if account is locked or inactive
   */
  private async checkAccountStatus(user: any): Promise<void> {
    // Check if account is inactive
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check if account is locked
    if (user.status === UserStatus.LOCKED) {
      // Check if lock has expired
      if (user.lockedUntil && new Date() > user.lockedUntil) {
        // Automatically unlock the account
        await this.prisma.users.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        this.logger.log(`Account automatically unlocked for user: ${user.id}`);
      } else {
        const lockedUntilStr = user.lockedUntil
          ? user.lockedUntil.toISOString()
          : 'unknown';
        throw new UnauthorizedException(
          `Account is locked until ${lockedUntilStr}`,
        );
      }
    }
  }

  /**
   * Create authentication response with tokens and session
   *
   * @param user - User object
   * @param context - Request context
   * @returns Authentication response
   */
  private async createAuthResponse(
    user: any,
    context: RequestContext,
  ): Promise<AuthResponse> {
    this.logger.debug(`Creating auth response for user: ${user.id}`);

    // Get user permissions
    const permissions = await this.getUserPermissions(user.id);

    // Generate access token
    const accessToken = await this.tokenService.generateAccessToken(
      user,
      permissions,
    );

    // Generate refresh token
    const refreshToken = await this.tokenService.generateRefreshToken();

    // Calculate access token fingerprint
    const accessTokenFingerprint = this.tokenService.calculatePermissionFingerprint(permissions);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.sessionService.createSession({
      userId: user.id,
      refreshToken,
      accessTokenFingerprint,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt,
    });

    this.logger.log(`Auth response created for user: ${user.id}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hierarchyLevel: user.hierarchyLevel,
        organizationId: user.organizationId,
      },
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Get user permissions from database
   *
   * @param userId - User ID
   * @returns Permission set
   */
  private async getUserPermissions(userId: string): Promise<any> {
    const permissionRecords = await this.prisma.permission_matrices.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });

    const modules = new Map<string, string[]>();
    
    for (const record of permissionRecords) {
      modules.set(record.module, record.actions);
    }

    const fingerprint = this.tokenService.calculatePermissionFingerprint({
      modules,
      fingerprint: '',
    });

    return {
      modules,
      fingerprint,
    };
  }
}
