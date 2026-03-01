import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

/**
 * Number of salt rounds for bcrypt hashing
 * Minimum 10 rounds as per security requirements
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt with appropriate salt rounds
 * @param password - Plain text password to hash
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash a PIN using bcrypt with appropriate salt rounds
 * @param pin - Plain text PIN (4-6 digits) to hash
 * @returns Promise resolving to the hashed PIN
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a PIN against a bcrypt hash
 * @param pin - Plain text PIN to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if PIN matches, false otherwise
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Create a fingerprint of a token for blacklisting purposes
 * Uses SHA-256 to create a consistent, non-reversible identifier
 * @param token - JWT token to fingerprint
 * @returns Hex string representing the token fingerprint
 */
export function createTokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
