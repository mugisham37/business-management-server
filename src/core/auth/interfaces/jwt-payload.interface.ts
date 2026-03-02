import { HierarchyLevel } from '@prisma/client';

/**
 * JWT Payload Interface
 * Represents the data stored in JWT tokens
 */
export interface JwtPayload {
  userId: string;
  organizationId: string;
  hierarchyLevel: HierarchyLevel;
  branchId: string | null;
  departmentId: string | null;
  permissionFingerprint: string;
  email: string;
  iat?: number;
  exp?: number;
}
