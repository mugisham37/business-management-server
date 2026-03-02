import { HierarchyLevel } from '@prisma/client';

/**
 * User Context Interface
 * Extended user information available in request context
 * Includes permissions and roles for authorization
 */
export interface UserContext {
  userId: string;
  organizationId: string;
  hierarchyLevel: HierarchyLevel;
  branchId: string | null;
  departmentId: string | null;
  permissionFingerprint: string;
  email: string;
  permissions: string[];
  roles: string[];
}
