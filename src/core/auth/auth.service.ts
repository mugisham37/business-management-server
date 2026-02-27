import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { JwtPayload, AuthTokens, UserContext } from './interfaces';
import { AppConfig } from '../config/configuration';

/**
 * Authentication Service
 * Handles user authentication, token generation, and password management
 */
@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly redisService: RedisService,
  ) {
    this.bcryptRounds = this.configService.get('auth.bcryptRounds', {
      infer: true,
    })!;
    this.jwtExpiresIn = this.configService.get('auth.jwtExpiresIn', {
      infer: true,
    })!;
    this.refreshTokenExpiresIn = this.configService.get(
      'auth.refreshTokenExpiresIn',
      { infer: true },
    )!;
  }

  /**
   * Authenticate user with email and password
   * @param email User email
   * @param password User password
   * @returns Authentication tokens
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    // Find user with roles and permissions
    const user = await this.prisma.user.findUnique({
      where: { email, isActive: true, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Extract roles and permissions
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    // Generate tokens
    return this.generateTokens(user.id, user.email, roles, permissions, user.tenantId);
  }

  /**
   * Register a new user
   * @param email User email
   * @param password User password
   * @param firstName User first name
   * @param lastName User last name
   * @param tenantId Tenant ID
   * @returns Created user (without password)
   */
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    tenantId: string,
  ): Promise<Omit<any, 'password'>> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        tenantId,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token
   * @returns New authentication tokens
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Check if refresh token is blacklisted
      const isBlacklisted = await this.redisService.exists(
        `blacklist:${refreshToken}`,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Get user with fresh data
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, isActive: true, deletedAt: null },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Extract roles and permissions
      const roles = user.roles.map((ur) => ur.role.name);
      const permissions = user.roles.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.name),
      );

      // Generate new tokens
      return this.generateTokens(
        user.id,
        user.email,
        roles,
        permissions,
        user.tenantId,
      );
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate user from JWT payload
   * @param payload JWT payload
   * @returns User context
   */
  async validateUser(payload: JwtPayload): Promise<UserContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      tenantId: payload.tenantId,
    };
  }

  /**
   * Hash password using bcrypt
   * @param password Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Verify password against hash
   * @param password Plain text password
   * @param hash Hashed password
   * @returns True if password matches
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access and refresh tokens
   * @param userId User ID
   * @param email User email
   * @param roles User roles
   * @param permissions User permissions
   * @param tenantId Tenant ID
   * @returns Authentication tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    tenantId: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
      permissions,
      tenantId,
    };

    // Access token uses default expiration from module config
    const accessToken = await this.jwtService.signAsync(payload as any);

    // Refresh token with custom expiration
    const refreshToken = await this.jwtService.signAsync(
      payload as any,
      {
        expiresIn: this.refreshTokenExpiresIn as any,
      }
    );

    // Parse expiration time to seconds
    const expiresIn = this.parseExpirationTime(this.jwtExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Parse expiration time string to seconds
   * @param expiresIn Expiration time string (e.g., '15m', '7d')
   * @returns Expiration time in seconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900; // Default 15 minutes
    }
  }

  /**
   * Revoke refresh token by adding to blacklist
   * @param refreshToken Refresh token to revoke
   */
  async revokeToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      const ttl = payload.exp! - Math.floor(Date.now() / 1000);
      
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl);
      }
    } catch (error) {
      // Token is invalid or expired, no need to blacklist
    }
  }
}
