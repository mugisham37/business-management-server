/**
 * Auth Helper for Test Authentication
 * Provides utilities for generating test tokens and authentication
 */

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

export interface TestTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
}

export interface TestTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthHelper {
  private jwtService: JwtService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor(
    jwtService?: JwtService,
    jwtSecret?: string,
    jwtRefreshSecret?: string,
  ) {
    this.jwtService =
      jwtService ||
      new JwtService({
        secret: jwtSecret || process.env.JWT_SECRET || 'test-secret',
      });
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'test-secret';
    this.jwtRefreshSecret =
      jwtRefreshSecret ||
      process.env.JWT_REFRESH_SECRET ||
      'test-refresh-secret';
  }

  /**
   * Generate access token for testing
   */
  generateAccessToken(payload: TestTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '1h',
    });
  }

  /**
   * Generate refresh token for testing
   */
  generateRefreshToken(payload: TestTokenPayload): string {
    return this.jwtService.sign(
      { sub: payload.sub, email: payload.email },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      },
    );
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokens(payload: TestTokenPayload): TestTokens {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): TestTokenPayload {
    return this.jwtService.verify(token, {
      secret: this.jwtSecret,
    });
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): Partial<TestTokenPayload> {
    return this.jwtService.verify(token, {
      secret: this.jwtRefreshSecret,
    });
  }

  /**
   * Hash password for testing
   */
  async hashPassword(password: string): Promise<string> {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '4', 10);
    return bcrypt.hash(password, rounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate API key for testing
   */
  generateApiKey(): string {
    return `test_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create authorization header with Bearer token
   */
  createAuthHeader(token: string): { Authorization: string } {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Create test user payload with default values
   */
  createTestPayload(overrides?: Partial<TestTokenPayload>): TestTokenPayload {
    return {
      sub: 'test-user-id',
      email: 'test@example.com',
      tenantId: 'test-tenant-id',
      roles: ['user'],
      permissions: [],
      ...overrides,
    };
  }
}
