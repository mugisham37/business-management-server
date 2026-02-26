import { Prisma } from '@prisma/client';

/**
 * Soft Delete Middleware
 * 
 * Intercepts delete operations and converts them to updates that set deletedAt timestamp.
 * Also filters out soft-deleted records from queries unless explicitly requested.
 * 
 * Features:
 * - Converts delete to update with deletedAt
 * - Converts deleteMany to updateMany with deletedAt
 * - Filters soft-deleted records from findMany, findFirst, count
 * - Preserves explicit deletedAt filters
 */
export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Models that support soft delete (have deletedAt field)
    const softDeleteModels = ['User', 'Tenant', 'Role', 'Permission', 'SystemConfig'];

    if (!softDeleteModels.includes(params.model || '')) {
      return next(params);
    }

    // Convert delete to update with deletedAt
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }

    // Convert deleteMany to updateMany with deletedAt
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data.deletedAt = new Date();
      } else {
        params.args.data = { deletedAt: new Date() };
      }
    }

    // Filter out soft-deleted records from queries
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      // Add deletedAt: null to where clause if not explicitly set
      if (!params.args.where?.deletedAt) {
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }
    }

    if (params.action === 'findMany') {
      // Add deletedAt: null to where clause if not explicitly set
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }

    if (params.action === 'count') {
      // Add deletedAt: null to where clause if not explicitly set
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }

    // Update operations should also filter soft-deleted records
    if (params.action === 'update') {
      if (!params.args.where?.deletedAt) {
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }
    }

    if (params.action === 'updateMany') {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }

    return next(params);
  };
}
