/**
 * Session-related types
 */

/**
 * Token payload from JWT
 */
export interface TokenPayload {
  userId: string;
  organizationId: string;
  hierarchyLevel: string;
  branchId: string | null;
  departmentId: string | null;
  permissionFingerprint: string;
  iat: number;
  exp: number;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
