/**
 * User Context Interface
 * Represents the authenticated user's context in request handlers
 */
export interface UserContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
}
