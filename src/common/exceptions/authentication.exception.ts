import { UnauthorizedException } from '@nestjs/common';

/**
 * Authentication exceptions with specific reasons
 * 
 * Requirement 15.6, 17.8
 */

/**
 * Invalid credentials exception
 */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsException';
  }
}

/**
 * Account locked exception
 */
export class AccountLockedException extends UnauthorizedException {
  public readonly lockedUntil: Date;

  constructor(lockedUntil: Date) {
    super(`Account is locked until ${lockedUntil.toISOString()}`);
    this.lockedUntil = lockedUntil;
    this.name = 'AccountLockedException';
  }
}

/**
 * Account inactive exception
 */
export class AccountInactiveException extends UnauthorizedException {
  constructor() {
    super('Account is inactive');
    this.name = 'AccountInactiveException';
  }
}

/**
 * Token expired exception
 */
export class TokenExpiredException extends UnauthorizedException {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredException';
  }
}

/**
 * Token blacklisted exception
 */
export class TokenBlacklistedException extends UnauthorizedException {
  constructor() {
    super('Token has been revoked');
    this.name = 'TokenBlacklistedException';
  }
}

/**
 * Permission fingerprint mismatch exception
 */
export class PermissionFingerprintMismatchException extends UnauthorizedException {
  constructor() {
    super('Permissions have changed. Please re-authenticate.');
    this.name = 'PermissionFingerprintMismatchException';
  }
}

/**
 * Invalid token exception
 */
export class InvalidTokenException extends UnauthorizedException {
  constructor(reason?: string) {
    super(reason || 'Invalid token');
    this.name = 'InvalidTokenException';
  }
}

/**
 * Rate limit exceeded exception
 */
export class RateLimitExceededException extends UnauthorizedException {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
    this.retryAfter = retryAfter;
    this.name = 'RateLimitExceededException';
  }
}
