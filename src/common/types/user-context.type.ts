import { HierarchyLevel } from '@prisma/client';

/**
 * User context extracted from JWT and used throughout the application
 */
export interface UserContext {
  userId: string;
  organizationId: string;
  hierarchyLevel: HierarchyLevel;
  branchId: string | null;
  departmentId: string | null;
  permissionFingerprint: string;
  email: string;
}

/**
 * Request context containing client information
 */
export interface RequestContext {
  ipAddress: string;
  userAgent: string;
}
