import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BaseResolver } from './base.resolver';
import { PermissionService } from '../../../modules/permission/permission.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import {
  GrantPermissionsInput,
  RevokePermissionsInput,
  UserPermissionsResponse,
  PermissionHistoryResponse,
  ModulePermissionType,
} from '../types/permission.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * PermissionResolver
 *
 * Handles GraphQL mutations and queries for permission management including:
 * - Permission grants with delegation validation
 * - Permission revocations with cascade
 * - User permission queries
 * - Permission history queries
 *
 * Requirements: 5.1, 5.4, 5.8, 6.1, 15.2
 */
@Resolver()
export class PermissionResolver extends BaseResolver {
  constructor(private readonly permissionService: PermissionService) {
    super('PermissionResolver');
  }

  /**
   * Grant permissions to a user
   *
   * Requirement 5.1: Validate delegation (granter must possess permissions being granted)
   * Requirement 5.4: Grant permissions with delegation validation
   * Requirement 15.2: Apply permission guard
   *
   * @param input - Grant permissions input
   * @param currentUser - Current authenticated user (granter)
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'GRANT_PERMISSIONS')
  @Mutation(() => Boolean, { name: 'grantPermissions' })
  async grantPermissions(
    @Args('input') input: GrantPermissionsInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<boolean> {
    this.logOperation('grantPermissions', {
      granterId: currentUser.userId,
      recipientId: input.userId,
      permissionCount: input.permissions.length,
    });

    await this.permissionService.grantPermissions(
      {
        userId: input.userId,
        permissions: input.permissions.map((p) => ({
          module: p.module,
          actions: p.actions,
        })),
      },
      currentUser.userId,
    );

    return true;
  }

  /**
   * Revoke permissions from a user
   *
   * Requirement 6.1: Revoke permissions and cascade to subordinates
   * Requirement 15.2: Apply permission guard
   *
   * @param input - Revoke permissions input
   * @param currentUser - Current authenticated user (revoker)
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'GRANT_PERMISSIONS')
  @Mutation(() => Boolean, { name: 'revokePermissions' })
  async revokePermissions(
    @Args('input') input: RevokePermissionsInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<boolean> {
    this.logOperation('revokePermissions', {
      revokerId: currentUser.userId,
      recipientId: input.userId,
      modules: input.modules,
    });

    await this.permissionService.revokePermissions(
      {
        userId: input.userId,
        modules: input.modules,
      },
      currentUser.userId,
    );

    return true;
  }

  /**
   * Get user's active permissions
   *
   * Requirement 5.8: Query user permissions
   * Requirement 15.2: Apply permission guard
   *
   * @param userId - User ID to query permissions for
   * @param currentUser - Current authenticated user
   * @returns User permissions with fingerprint
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => UserPermissionsResponse, { name: 'getUserPermissions' })
  async getUserPermissions(
    @Args('userId') userId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<UserPermissionsResponse> {
    this.logOperation('getUserPermissions', {
      requesterId: currentUser.userId,
      targetUserId: userId,
    });

    const permissionSet = await this.permissionService.getUserPermissions(userId);

    // Convert Map to array of ModulePermissionType
    const permissions: ModulePermissionType[] = [];
    for (const [module, actions] of Object.entries(permissionSet.modules)) {
      permissions.push({
        module,
        actions: actions as string[],
      });
    }

    return {
      userId,
      permissions,
      fingerprint: permissionSet.fingerprint,
    };
  }

  /**
   * Get permission history for a user
   *
   * Requirement 5.8: Query permission history and snapshots
   * Requirement 15.2: Apply permission guard
   *
   * @param userId - User ID to query history for
   * @param currentUser - Current authenticated user
   * @returns Permission history with snapshots
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => PermissionHistoryResponse, { name: 'getPermissionHistory' })
  async getPermissionHistory(
    @Args('userId') userId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<PermissionHistoryResponse> {
    this.logOperation('getPermissionHistory', {
      requesterId: currentUser.userId,
      targetUserId: userId,
    });

    const snapshots = await this.permissionService.getPermissionHistory(userId);

    return {
      userId,
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        userId: snapshot.userId,
        snapshotData: snapshot.snapshotData,
        fingerprintHash: snapshot.fingerprintHash,
        reason: snapshot.reason,
        createdAt: snapshot.createdAt,
      })),
      total: snapshots.length,
    };
  }
}
