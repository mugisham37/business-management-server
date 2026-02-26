import { Prisma } from '@prisma/client';

/**
 * Tenant Isolation Middleware
 * 
 * Automatically filters queries by tenant ID based on request context.
 * Ensures multi-tenant data isolation at the database level.
 * 
 * Features:
 * - Adds tenantId filter to all queries for tenant-scoped models
 * - Prevents cross-tenant data access
 * - Preserves explicit tenantId filters
 * 
 * Note: This middleware requires tenant context to be set.
 * In a real application, this would come from request context (e.g., AsyncLocalStorage).
 */

// Global tenant context (in production, use AsyncLocalStorage or similar)
let currentTenantId: string | null = null;

export function setTenantContext(tenantId: string | null): void {
  currentTenantId = tenantId;
}

export function getTenantContext(): string | null {
  return currentTenantId;
}

export function clearTenantContext(): void {
  currentTenantId = null;
}

export function tenantMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Models that are tenant-scoped (have tenantId field)
    const tenantScopedModels = ['User', 'AuditLog'];

    if (!tenantScopedModels.includes(params.model || '')) {
      return next(params);
    }

    const tenantId = getTenantContext();

    // If no tenant context, proceed without filtering (for system operations)
    if (!tenantId) {
      return next(params);
    }

    // Add tenantId filter to queries
    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'count'
    ) {
      if (params.args.where) {
        // Only add tenantId if not explicitly set
        if (params.args.where.tenantId === undefined) {
          params.args.where.tenantId = tenantId;
        }
      } else {
        params.args.where = { tenantId };
      }
    }

    // Add tenantId to create operations
    if (params.action === 'create') {
      if (params.args.data) {
        // Only add tenantId if not explicitly set
        if (params.args.data.tenantId === undefined) {
          params.args.data.tenantId = tenantId;
        }
      }
    }

    // Add tenantId to createMany operations
    if (params.action === 'createMany') {
      if (params.args.data) {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: any) => ({
            ...item,
            tenantId: item.tenantId ?? tenantId,
          }));
        }
      }
    }

    // Add tenantId filter to update operations
    if (params.action === 'update' || params.action === 'updateMany') {
      if (params.args.where) {
        if (params.args.where.tenantId === undefined) {
          params.args.where.tenantId = tenantId;
        }
      } else {
        params.args.where = { tenantId };
      }
    }

    // Add tenantId filter to delete operations
    if (params.action === 'delete' || params.action === 'deleteMany') {
      if (params.args.where) {
        if (params.args.where.tenantId === undefined) {
          params.args.where.tenantId = tenantId;
        }
      } else {
        params.args.where = { tenantId };
      }
    }

    return next(params);
  };
}
