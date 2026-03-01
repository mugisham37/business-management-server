import { Prisma } from '@prisma/client';
import { HierarchyLevel } from '@prisma/client';
import { RequestContextService } from '../../context/request-context.service';

/**
 * Scope filter middleware for Prisma
 * 
 * Automatically filters queries by branch/department for MANAGER and WORKER users.
 * Owners bypass scope filtering and can access all data organization-wide.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 * 
 * Layer 3 of the four-layer authorization system:
 * - Extracts user context from AsyncLocalStorage
 * - Applies scope filtering based on hierarchy level
 * - Injects WHERE clauses for branchId and departmentId
 * - Bypasses filtering for OWNER users
 */
export function scopeFilterMiddleware(contextService: RequestContextService) {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) => {
    // Extract user context from AsyncLocalStorage
    const userContext = contextService.getUserContext();

    // Skip if no user context (e.g., system operations, seeds)
    if (!userContext) {
      return next(params);
    }

    // Requirement 9.3: Owners bypass scope filtering
    if (userContext.hierarchyLevel === HierarchyLevel.OWNER) {
      return next(params);
    }

    // Requirement 9.4: Apply to all Prisma queries through middleware
    // Only apply to read operations (findMany, findFirst, findUnique, count, aggregate)
    const readOperations = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'];
    if (!readOperations.includes(params.action)) {
      return next(params);
    }

    // Models that should have scope filtering applied
    // These are models that have branchId and/or departmentId fields
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

    // Requirement 9.2: Apply scope filter for MANAGER and WORKER
    if (
      userContext.hierarchyLevel === HierarchyLevel.MANAGER ||
      userContext.hierarchyLevel === HierarchyLevel.WORKER
    ) {
      // Initialize where clause if it doesn't exist
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }

      // Requirement 9.1: Add WHERE clauses filtering by branchId and departmentId
      const scopeFilter: any = {};

      if (userContext.branchId) {
        scopeFilter.branchId = userContext.branchId;
      }

      if (userContext.departmentId) {
        scopeFilter.departmentId = userContext.departmentId;
      }

      // Merge with existing where clause
      // Requirement 9.5: Return empty results or access denied for out-of-scope resources
      if (Object.keys(scopeFilter).length > 0) {
        // Use AND to combine existing filters with scope filters
        // This ensures the user can only see data within their scope
        params.args.where = {
          AND: [params.args.where, scopeFilter],
        };
      }
    }

    return next(params);
  };
}
