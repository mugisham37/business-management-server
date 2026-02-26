import { Prisma } from '@prisma/client';

/**
 * Audit Logging Middleware
 * 
 * Records all create, update, and delete operations in the audit log.
 * Captures old and new values for tracking changes.
 * 
 * Features:
 * - Logs create operations with new values
 * - Logs update operations with old and new values
 * - Logs delete operations with old values
 * - Captures user ID and tenant ID from context
 * - Stores IP address and user agent if available
 * 
 * Note: This middleware requires user context to be set.
 * In a real application, this would come from request context (e.g., AsyncLocalStorage).
 */

interface AuditContext {
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Global audit context (in production, use AsyncLocalStorage or similar)
let currentAuditContext: AuditContext = {};

export function setAuditContext(context: AuditContext): void {
  currentAuditContext = context;
}

export function getAuditContext(): AuditContext {
  return currentAuditContext;
}

export function clearAuditContext(): void {
  currentAuditContext = {};
}

export function auditMiddleware(prisma: any): Prisma.Middleware {
  return async (params, next) => {
    // Models to audit (exclude AuditLog itself to prevent recursion)
    const auditedModels = ['User', 'Tenant', 'Role', 'Permission', 'SystemConfig', 'UserRole', 'RolePermission'];

    if (!auditedModels.includes(params.model || '')) {
      return next(params);
    }

    const context = getAuditContext();
    const entity = params.model || 'Unknown';

    // Handle CREATE operations
    if (params.action === 'create') {
      const result = await next(params);
      
      // Create audit log entry
      try {
        await prisma.auditLog.create({
          data: {
            userId: context.userId,
            tenantId: context.tenantId,
            entity,
            entityId: result.id,
            action: 'CREATE',
            oldValue: null,
            newValue: result,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      } catch (error) {
        // Log error but don't fail the operation
        console.error('Failed to create audit log:', error);
      }

      return result;
    }

    // Handle UPDATE operations
    if (params.action === 'update') {
      // Fetch old value before update
      let oldValue = null;
      try {
        oldValue = await prisma[params.model?.toLowerCase() || ''].findUnique({
          where: params.args.where,
        });
      } catch (error) {
        // Continue even if we can't fetch old value
      }

      const result = await next(params);

      // Create audit log entry
      try {
        await prisma.auditLog.create({
          data: {
            userId: context.userId,
            tenantId: context.tenantId,
            entity,
            entityId: result.id,
            action: 'UPDATE',
            oldValue,
            newValue: result,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }

      return result;
    }

    // Handle DELETE operations (including soft deletes)
    if (params.action === 'delete') {
      // Fetch old value before delete
      let oldValue = null;
      try {
        oldValue = await prisma[params.model?.toLowerCase() || ''].findUnique({
          where: params.args.where,
        });
      } catch (error) {
        // Continue even if we can't fetch old value
      }

      const result = await next(params);

      // Create audit log entry
      try {
        await prisma.auditLog.create({
          data: {
            userId: context.userId,
            tenantId: context.tenantId,
            entity,
            entityId: oldValue?.id || 'unknown',
            action: 'DELETE',
            oldValue,
            newValue: null,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }

      return result;
    }

    return next(params);
  };
}
