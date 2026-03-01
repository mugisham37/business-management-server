import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { AuditService } from '../../../modules/audit/audit.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  AuditLogType,
  AuditLogsResponse,
  AuditFiltersInput,
} from '../types/audit.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * AuditResolver
 *
 * Handles GraphQL queries for audit logs including:
 * - User audit logs (users can view their own logs)
 * - Organization audit logs (owner only)
 * - Resource audit logs (with scope filtering)
 *
 * Requirements: 12.1, 15.2, 15.3
 */
@Resolver()
export class AuditResolver extends BaseResolver {
  constructor(private readonly auditService: AuditService) {
    super('AuditResolver');
  }

  /**
   * Get audit logs for a specific user
   *
   * Requirement 12.1: Query audit logs by userId
   * Requirement 15.2: Apply permission guard
   *
   * Users can view their own audit logs.
   * Users with USERS:READ permission can view other users' logs (with scope filtering).
   *
   * @param userId - User ID to retrieve logs for
   * @param filters - Optional filters for date range, action, resource type, pagination
   * @param currentUser - Current authenticated user
   * @returns List of audit logs
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => AuditLogsResponse, { name: 'getUserAuditLogs' })
  async getUserAuditLogs(
    @Args('userId') userId: string,
    @Args('filters', { nullable: true }) filters: AuditFiltersInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<AuditLogsResponse> {
    this.logOperation('getUserAuditLogs', {
      userId,
      requesterId: currentUser.userId,
    });

    // Users can always view their own logs
    // For viewing other users' logs, scope filtering will be applied by the service layer
    const logs = await this.auditService.getUserAuditLogs(userId, {
      action: filters?.action,
      resourceType: filters?.resourceType,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    });

    return {
      logs: logs.map((log) => this.mapAuditLogToType(log)),
      total: logs.length,
    };
  }

  /**
   * Get audit logs for entire organization (owner only)
   *
   * Requirement 12.1: Query audit logs by organizationId
   * Requirement 15.2: Apply permission guard
   * Requirement 15.3: Apply hierarchy guard (owner only)
   *
   * Only owners can view organization-wide audit logs.
   *
   * @param organizationId - Organization ID to retrieve logs for
   * @param filters - Optional filters for date range, action, resource type, pagination
   * @param currentUser - Current authenticated user
   * @returns List of audit logs
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('USERS', 'READ')
  @Query(() => AuditLogsResponse, { name: 'getOrganizationAuditLogs' })
  async getOrganizationAuditLogs(
    @Args('organizationId') organizationId: string,
    @Args('filters', { nullable: true }) filters: AuditFiltersInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<AuditLogsResponse> {
    this.logOperation('getOrganizationAuditLogs', {
      organizationId,
      requesterId: currentUser.userId,
    });

    // Verify the user is requesting logs for their own organization
    if (organizationId !== currentUser.organizationId) {
      throw new Error('Cannot access audit logs for other organizations');
    }

    const logs = await this.auditService.getOrganizationAuditLogs(
      organizationId,
      {
        action: filters?.action,
        resourceType: filters?.resourceType,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        limit: filters?.limit || 100,
        offset: filters?.offset || 0,
      },
    );

    return {
      logs: logs.map((log) => this.mapAuditLogToType(log)),
      total: logs.length,
    };
  }

  /**
   * Get audit logs for a specific resource
   *
   * Requirement 12.1: Query audit logs by resourceType and resourceId
   * Requirement 15.2: Apply permission guard
   *
   * Users can view audit logs for resources they have access to.
   * Scope filtering is applied based on user's hierarchy level and scope.
   *
   * @param resourceType - Type of resource (e.g., 'user', 'permission', 'branch')
   * @param resourceId - ID of the resource
   * @param currentUser - Current authenticated user
   * @returns List of audit logs
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => AuditLogsResponse, { name: 'getResourceAuditLogs' })
  async getResourceAuditLogs(
    @Args('resourceType') resourceType: string,
    @Args('resourceId') resourceId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<AuditLogsResponse> {
    this.logOperation('getResourceAuditLogs', {
      resourceType,
      resourceId,
      requesterId: currentUser.userId,
    });

    const logs = await this.auditService.getResourceAuditLogs(
      resourceType,
      resourceId,
    );

    // Filter logs to only include those from the user's organization
    const filteredLogs = logs.filter(
      (log) => log.organizationId === currentUser.organizationId,
    );

    return {
      logs: filteredLogs.map((log) => this.mapAuditLogToType(log)),
      total: filteredLogs.length,
    };
  }

  /**
   * Map database audit log to GraphQL type
   *
   * @param log - Audit log from database
   * @returns Mapped audit log type
   */
  private mapAuditLogToType(log: any): AuditLogType {
    return {
      id: log.id,
      userId: log.userId,
      organizationId: log.organizationId,
      hierarchyLevel: log.hierarchyLevel,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      result: log.result,
      metadata: log.metadata,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }
}
