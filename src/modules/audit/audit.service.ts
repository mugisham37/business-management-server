import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditLogDto, AuditFilters } from '../../common/types/audit.type';
import { LoggerService } from '../../core/logging/logger.service';
import { audit_logs } from '@prisma/client';

/**
 * Audit Service
 * 
 * Handles immutable audit logging with async processing.
 * Uses Bull queue to process audit logs asynchronously without blocking main requests.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */
@Injectable()
export class AuditService {
  private readonly logger: LoggerService;

  constructor(
    @InjectQueue('audit') private readonly auditQueue: Queue,
    private readonly prisma: PrismaService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('AuditService');
  }

  /**
   * Log action asynchronously using Bull queue
   * 
   * Requirement 12.1: Log all actions with userId, organizationId, action, resourceType, resourceId, result, timestamp
   * Requirement 12.2: Include oldValue and newValue as JSON in metadata for data modifications
   * Requirement 12.3: Capture ipAddress and userAgent from request context
   * Requirement 12.4: Write logs asynchronously to avoid blocking main request
   * Requirement 12.7: When logging fails, log error but don't fail main request
   * 
   * @param dto - Audit log data
   */
  async logAction(dto: AuditLogDto): Promise<void> {
    try {
      // Add job to queue for async processing
      await this.auditQueue.add('log-action', dto, {
        priority: this.getPriority(dto.action),
      });

      this.logger.logWithMetadata('debug', 'Audit log queued', {
        action: dto.action,
        resourceType: dto.resourceType,
        userId: dto.userId,
      });
    } catch (error) {
      // Requirement 12.7: Log failure but don't throw
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed to queue audit log for action ${dto.action}`,
        errorStack,
      );
    }
  }

  /**
   * Get audit logs for a specific user with filters
   * 
   * Requirement 12.1: Query audit logs by userId
   * 
   * @param userId - User ID to filter by
   * @param filters - Optional filters for date range, action, resource type, pagination
   * @returns Array of audit log records
   */
  async getUserAuditLogs(
    userId: string,
    filters?: AuditFilters,
  ): Promise<audit_logs[]> {
    try {
      const where: any = { userId };

      if (filters?.action) {
        where.action = filters.action;
      }

      if (filters?.resourceType) {
        where.resourceType = filters.resourceType;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const logs = await this.prisma.audit_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
      });

      this.logger.logWithMetadata('debug', 'Retrieved user audit logs', {
        userId,
        count: logs.length,
      });

      return logs;
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Failed to retrieve user audit logs for ${userId}`, errorStack);
      throw error;
    }
  }

  /**
   * Get audit logs for an entire organization with filters
   * 
   * Requirement 12.1: Query audit logs by organizationId
   * 
   * @param organizationId - Organization ID to filter by
   * @param filters - Optional filters for date range, action, resource type, pagination
   * @returns Array of audit log records
   */
  async getOrganizationAuditLogs(
    organizationId: string,
    filters?: AuditFilters,
  ): Promise<audit_logs[]> {
    try {
      const where: any = { organizationId };

      if (filters?.action) {
        where.action = filters.action;
      }

      if (filters?.resourceType) {
        where.resourceType = filters.resourceType;
      }

      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const logs = await this.prisma.audit_logs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 100,
        skip: filters?.offset || 0,
      });

      this.logger.logWithMetadata('debug', 'Retrieved organization audit logs', {
        organizationId,
        count: logs.length,
      });

      return logs;
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed to retrieve organization audit logs for ${organizationId}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Get audit logs for a specific resource
   * 
   * Requirement 12.1: Query audit logs by resourceType and resourceId
   * 
   * @param resourceType - Type of resource (e.g., 'user', 'permission', 'branch')
   * @param resourceId - ID of the resource
   * @returns Array of audit log records
   */
  async getResourceAuditLogs(
    resourceType: string,
    resourceId: string,
  ): Promise<audit_logs[]> {
    try {
      const logs = await this.prisma.audit_logs.findMany({
        where: {
          resourceType,
          resourceId,
        },
        orderBy: { createdAt: 'desc' },
      });

      this.logger.logWithMetadata('debug', 'Retrieved resource audit logs', {
        resourceType,
        resourceId,
        count: logs.length,
      });

      return logs;
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed to retrieve resource audit logs for ${resourceType}:${resourceId}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Get priority for audit log based on action type
   * Critical actions (security-related) get higher priority
   * 
   * @param action - Audit action type
   * @returns Priority number (lower = higher priority)
   */
  private getPriority(action: string): number {
    const highPriorityActions = [
      'LOGIN',
      'LOGOUT',
      'ACCESS_DENIED',
      'PASSWORD_CHANGE',
      'PERMISSION_GRANT',
      'PERMISSION_REVOKE',
    ];

    return highPriorityActions.includes(action) ? 1 : 5;
  }
}
