import * as bcrypt from 'bcrypt';
import { PASSWORD_CONFIG } from '../constants';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_CONFIG.BCRYPT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash a PIN using bcrypt
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PASSWORD_CONFIG.BCRYPT_ROUNDS);
}

/**
 * Compare a PIN with a hash
 */
export async function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Hash a refresh token using bcrypt
 */
export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, PASSWORD_CONFIG.BCRYPT_ROUNDS);
}

/**
 * Compare a refresh token with a hash
 */
export async function compareRefreshToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
