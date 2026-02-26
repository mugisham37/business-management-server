import { Prisma } from '@prisma/client';

/**
 * Timestamp Middleware
 * 
 * Automatically sets createdAt and updatedAt timestamps on database operations.
 * 
 * Features:
 * - Sets createdAt and updatedAt on create operations
 * - Updates updatedAt on update operations
 * - Preserves explicit timestamp values if provided
 * 
 * Note: Prisma already handles this via @default(now()) and @updatedAt decorators,
 * but this middleware provides additional control and consistency.
 */
export function timestampMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const now = new Date();

    // Handle CREATE operations
    if (params.action === 'create') {
      if (params.args.data) {
        // Set createdAt if not explicitly provided
        if (params.args.data.createdAt === undefined) {
          params.args.data.createdAt = now;
        }
        // Set updatedAt if not explicitly provided
        if (params.args.data.updatedAt === undefined) {
          params.args.data.updatedAt = now;
        }
      }
    }

    // Handle CREATE MANY operations
    if (params.action === 'createMany') {
      if (params.args.data) {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: any) => ({
            ...item,
            createdAt: item.createdAt ?? now,
            updatedAt: item.updatedAt ?? now,
          }));
        }
      }
    }

    // Handle UPDATE operations
    if (params.action === 'update') {
      if (params.args.data) {
        // Set updatedAt if not explicitly provided
        if (params.args.data.updatedAt === undefined) {
          params.args.data.updatedAt = now;
        }
        // Ensure createdAt is not modified
        delete params.args.data.createdAt;
      }
    }

    // Handle UPDATE MANY operations
    if (params.action === 'updateMany') {
      if (params.args.data) {
        // Set updatedAt if not explicitly provided
        if (params.args.data.updatedAt === undefined) {
          params.args.data.updatedAt = now;
        }
        // Ensure createdAt is not modified
        delete params.args.data.createdAt;
      }
    }

    return next(params);
  };
}
