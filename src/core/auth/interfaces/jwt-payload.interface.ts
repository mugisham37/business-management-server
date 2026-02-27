/**
 * JWT Payload Interface
 * Defines the structure of data encoded in JWT tokens
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}
