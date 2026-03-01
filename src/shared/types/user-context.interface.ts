import { HierarchyLevel } from './hierarchy-level.enum';
import { PermissionMap } from './permission-map.type';

/**
 * User context embedded in JWT tokens and used throughout the system
 * Contains all necessary information for authentication and authorization
 */
export interface UserContext {
  /** Unique user identifier */
  userId: string;

  /** User's email address */
  email: string;

  /** Organization the user belongs to */
  organizationId: string;

  /** User's position in the organizational hierarchy */
  hierarchyLevel: HierarchyLevel;

  /** Branch assignment (optional, for scope-based access control) */
  branchId?: string;

  /** Department assignment (optional, for scope-based access control) */
  departmentId?: string;

  /** User's permissions mapped by module and actions */
  permissions: PermissionMap;

  /** Current session identifier */
  sessionId: string;
}
