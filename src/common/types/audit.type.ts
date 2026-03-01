import { HierarchyLevel } from '@prisma/client';

/**
 * Audit-related types
 */

/**
 * Audit log DTO for creating audit records
 */
export interface AuditLogDto {
  userId?: string;
  organizationId?: string;
  hierarchyLevel?: HierarchyLevel;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: string;
  metadata?: Record<string, any>;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit filters for querying audit logs
 */
export interface AuditFilters {
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
