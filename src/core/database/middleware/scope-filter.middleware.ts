import { Prisma } from '@prisma/client';
import { HierarchyLevel } from '@prisma/client';

/**
 * User context for scope filtering
 */
interface ScopeContext {
  userId?: string;
  hierarchyLevel?: HierarchyLevel;
  branchId?: string | null;
  departmentId?: string | null;
}

/**
 * Scope filter middleware for Prisma
 * Automatically filters queries by branch/department for MANAGER and WORKER users
 * Owners bypass scope filtering
 */
export function scopeFilterMiddleware() {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) => {
    // Extract scope context from params (will be set by request context)
    const scopeContext = (params as any).scopeContext as ScopeContext | undefined;

    // Skip if no scope context or user is OWNER
    if (!scopeContext || scopeContext.hierarchyLevel === HierarchyLevel.OWNER) {
      return next(params);
    }

    // Only apply to read operations (findMany, findFirst, findUnique, count, aggregate)
    const readOperations = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'];
    if (!readOperations.includes(params.action)) {
      return next(params);
    }

    // Models that should have scope filtering applied
    const scopedModels = [
      'users',
      'staff_profiles',
      'permission_matrices',
      'sessions',
      'audit_logs',
    ];

    // Skip if model doesn't need scope filtering
    if (!scopedModels.includes(params.model || '')) {
      return next(params);
    }

    // Apply scope filter based on hierarchy level
    if (
      scopeContext.hierarchyLevel === HierarchyLevel.MANAGER ||
      scopeContext.hierarchyLevel === HierarchyLevel.WORKER
    ) {
      // Initialize where clause if it doesn't exist
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }

      // Add scope filters
      const scopeFilter: any = {};

      if (scopeContext.branchId) {
        scopeFilter.branchId = scopeContext.branchId;
      }

      if (scopeContext.departmentId) {
        scopeFilter.departmentId = scopeContext.departmentId;
      }

      // Merge with existing where clause
      if (Object.keys(scopeFilter).length > 0) {
        params.args.where = {
          AND: [params.args.where, scopeFilter],
        };
      }
    }

    return next(params);
  };
}
