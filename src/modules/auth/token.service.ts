import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionSet } from '../../common/types/permission.type';
import { UserContext } from '../../common/types/user-context.type';
import type { users } from '@prisma/client';

/**
 * Token payload structure for JWT
 */
export interface TokenPayload {
  userId: string;
  organizationId: string;
  hierarchyLevel: string;
  branchId: string | null;
  departmentId: string | null;
  permissionFingerprint: string;
  email: string;
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for blacklisting
}

/**
 * Service for managing JWT access tokens and refresh tokens
 * Handles token generation, validation, rotation, and blacklisting
 */
@Injectable()
export class TokenService {
  private readonly logger: LoggerService;
  private readonly accessTokenExpiry: number;
  private readonly refreshTokenExpiry: number;
  private readonly jwtSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('TokenService');

    // Load configuration
    this.accessTokenExpiry =
      this.configService.get<number>('JWT_ACCESS_TOKEN_EXPIRY_SECONDS') || 900; // 15 minutes
    this.refreshTokenExpiry =
      this.configService.get<number>('JWT_REFRESH_TOKEN_EXPIRY_SECONDS') ||
      604800; // 7 days
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || '';

    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
  }

  /**
   * Generate access token with user context and permission fingerprint
   * Requirements: 3.1
   */
  async generateAccessToken(
    user: users,
    permissions: PermissionSet,
  ): Promise<string> {
    try {
      const jti = crypto.randomUUID();
      const permissionFingerprint = this.calculatePermissionFingerprint(permissions);

      const payload: TokenPayload = {
        userId: user.id,
        organizationId: user.organizationId,
        hierarchyLevel: user.hierarchyLevel,
        branchId: user.branchId,
        departmentId: user.departmentId,
        permissionFingerprint,
        email: user.email,
        jti,
      };

      const token = this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: this.accessTokenExpiry,
      });

      this.logger.logWithMetadata('debug', 'Access token generated', {
        userId: user.id,
        jti,
      });

      return token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error generating access token:', errorMessage);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token with cryptographic randomness
   * Requirements: 3.2
   */
  async generateRefreshToken(): Promise<string> {
    try {
      // Generate cryptographically secure random token (32 bytes = 256 bits)
      const token = crypto.randomBytes(32).toString('hex');

      this.logger.logWithMetadata('debug', 'Refresh token generated', {
        tokenLength: token.length,
      });

      return token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error generating refresh token:', errorMessage);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Validate access token with signature and expiry checks
   * Requirements: 3.1, 3.5, 3.6, 3.7, 3.8
   */
  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      // Verify JWT signature and expiry
      const payload = this.jwtService.verify<TokenPayload>(token, {
        secret: this.jwtSecret,
      });

      // Check if token is blacklisted
      if (payload.jti) {
        const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
        if (isBlacklisted) {
          this.logger.logWithMetadata('warn', 'Token is blacklisted', { jti: payload.jti });
          throw new Error('Token has been revoked');
        }
      }

      // Verify permission fingerprint matches current permissions
      const fingerprintValid = await this.verifyPermissionFingerprint(
        payload.userId,
        payload.permissionFingerprint,
      );

      if (!fingerprintValid) {
        this.logger.logWithMetadata('warn', 'Permission fingerprint mismatch', {
          userId: payload.userId,
        });
        throw new Error('Permission fingerprint mismatch - re-authentication required');
      }

      this.logger.logWithMetadata('debug', 'Access token validated', {
        userId: payload.userId,
        jti: payload.jti,
      });

      return payload;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TokenExpiredError') {
          this.logger.warn('Token expired');
          throw new Error('Token has expired');
        }
        if (error.name === 'JsonWebTokenError') {
          this.logger.warn('Invalid token signature');
          throw new Error('Invalid token');
        }
        throw error;
      }
      throw new Error('Token validation failed');
    }
  }

  /**
   * Calculate permission fingerprint using SHA-256
   * Requirements: 3.5
   */
  calculatePermissionFingerprint(permissions: PermissionSet): string {
    try {
      // Convert permissions map to sorted JSON for consistent hashing
      const permissionsObj: Record<string, string[]> = {};
      
      // Sort modules and actions for deterministic hash
      const sortedModules = Array.from(permissions.modules.keys()).sort();
      for (const module of sortedModules) {
        const actions = permissions.modules.get(module) || [];
        permissionsObj[module] = actions.sort();
      }

      const permissionsJson = JSON.stringify(permissionsObj);
      const hash = crypto
        .createHash('sha256')
        .update(permissionsJson)
        .digest('hex');

      this.logger.logWithMetadata('debug', 'Permission fingerprint calculated', {
        hash: hash.substring(0, 8) + '...',
      });

      return hash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error calculating permission fingerprint:', errorMessage);
      throw new Error('Failed to calculate permission fingerprint');
    }
  }

  /**
   * Verify permission fingerprint matches current user permissions
   * Requirements: 3.6
   */
  async verifyPermissionFingerprint(
    userId: string,
    fingerprint: string,
  ): Promise<boolean> {
    try {
      // Get current user permissions from database
      const permissionMatrices = await this.prismaService.permission_matrices.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        select: {
          module: true,
          actions: true,
        },
      });

      // Build permission set from database
      const currentPermissions: PermissionSet = {
        modules: new Map(),
        fingerprint: '',
      };

      for (const pm of permissionMatrices) {
        currentPermissions.modules.set(pm.module, pm.actions);
      }

      // Calculate fingerprint of current permissions
      const currentFingerprint = this.calculatePermissionFingerprint(currentPermissions);

      const isValid = currentFingerprint === fingerprint;

      this.logger.logWithMetadata('debug', 'Permission fingerprint verified', {
        userId,
        isValid,
      });

      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error verifying permission fingerprint:', errorMessage);
      // On error, fail closed (return false)
      return false;
    }
  }

  /**
   * Revoke token by adding to Redis blacklist
   * Requirements: 3.7, 3.8
   */
  async revokeToken(token: string): Promise<void> {
    try {
      // Decode token to get JTI and expiry
      const payload = this.jwtService.decode(token) as TokenPayload;

      if (!payload || !payload.jti) {
        this.logger.warn('Cannot revoke token without JTI');
        return;
      }

      // Calculate TTL based on token expiry
      const now = Math.floor(Date.now() / 1000);
      const exp = payload.exp || now + this.accessTokenExpiry;
      const ttl = Math.max(exp - now, 0);

      if (ttl > 0) {
        // Add JTI to blacklist with TTL matching token expiry
        const blacklistKey = `token:blacklist:${payload.jti}`;
        await this.redisService.set(blacklistKey, true, ttl);

        this.logger.logWithMetadata('info', 'Token revoked', {
          jti: payload.jti,
          userId: payload.userId,
          ttl,
        });
      } else {
        this.logger.logWithMetadata('debug', 'Token already expired, skipping blacklist', {
          jti: payload.jti,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error revoking token:', errorMessage);
      throw new Error('Failed to revoke token');
    }
  }
  /**
   * Refresh access token using refresh token with rotation
   * Requirements: 3.3, 3.4
   */
  async refreshAccessToken(
    refreshToken: string,
    sessionService: any,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      // Find session by refresh token
      const session = await sessionService.findByRefreshToken(refreshToken);

      if (!session) {
        this.logger.warn('Invalid or expired refresh token');
        throw new Error('Invalid or expired refresh token');
      }

      // Get user from database
      const user = await this.prismaService.users.findUnique({
        where: { id: session.userId },
      });

      if (!user) {
        this.logger.warn('User not found for session');
        throw new Error('User not found');
      }

      // Get current user permissions
      const permissionMatrices = await this.prismaService.permission_matrices.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        select: {
          module: true,
          actions: true,
        },
      });

      const permissions: PermissionSet = {
        modules: new Map(),
        fingerprint: '',
      };

      for (const pm of permissionMatrices) {
        permissions.modules.set(pm.module, pm.actions);
      }

      permissions.fingerprint = this.calculatePermissionFingerprint(permissions);

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(user, permissions);

      // Generate new refresh token
      const newRefreshToken = await this.generateRefreshToken();

      // Rotate refresh token: revoke old session and create new one
      await sessionService.rotateRefreshToken(
        session.id,
        newRefreshToken,
        permissions.fingerprint,
      );

      this.logger.logWithMetadata('info', 'Access token refreshed', {
        userId: user.id,
        sessionId: session.id,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.accessTokenExpiry,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error refreshing access token:', errorMessage);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const blacklistKey = `token:blacklist:${jti}`;
      const exists = await this.redisService.exists(blacklistKey);
      return exists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Error checking token blacklist:', errorMessage);
      // On error, fail closed (assume blacklisted)
      return true;
    }
  }

  /**
   * Extract user context from token payload
   */
  extractUserContext(payload: TokenPayload): UserContext {
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      hierarchyLevel: payload.hierarchyLevel as any,
      branchId: payload.branchId,
      departmentId: payload.departmentId,
      permissionFingerprint: payload.permissionFingerprint,
      email: payload.email,
    };
  }
}
