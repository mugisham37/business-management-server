/**
 * Authentication tokens returned after successful login
 * Contains both access and refresh tokens with metadata
 */
export interface AuthTokens {
  /** JWT access token (short-lived, 15 minutes) */
  accessToken: string;

  /** JWT refresh token (long-lived, 7 days) */
  refreshToken: string;

  /** Access token expiration time in seconds */
  expiresIn: number;

  /** Token type (always 'Bearer' for JWT) */
  tokenType: 'Bearer';
}
