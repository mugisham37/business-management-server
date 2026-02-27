/**
 * Authentication Tokens Interface
 * Represents the tokens returned after successful authentication
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}
