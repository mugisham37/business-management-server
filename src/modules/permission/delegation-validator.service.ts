import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionCacheService } from './permission-cache.service';

/**
 * Module permission structure
 */
export interface ModulePermission {
  module: string;
  actions: string[];
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  missingPermissions: ModulePermission[];
  message?: string;
}

/**
 * Service for validating permission delegation
 * Implements "The Golden Rule": Users can only grant permissions they possess
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
@Injectable()
export class DelegationValidatorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionCacheService: PermissionCacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('DelegationValidatorService');
  }

  /**
   * Validate that granter has all permissions being granted
   * Requirement 5.1, 5.2, 5.3
   * 
   * @param granterId - User ID of the granter
   * @param permissions - Permissions to be granted
   * @returns Validation result with missing permissions if invalid
   */
  async validateDelegation(
    granterId: string,
    permissions: ModulePermission[],
  ): Promise<ValidationResult> {
    try {
      // Get granter user to check hierarchy level
      const granter = await this.prismaService.users.findUnique({
        where: { id: granterId },
        select: {
          id: true,
          hierarchyLevel: true,
          organizationId: true,
        },
      });

      if (!granter) {
        return {
          valid: false,
          missingPermissions: [],
          message: 'Granter user not found',
        };
      }

      // Owners can grant any permission (Requirement 5.2)
      if (granter.hierarchyLevel === 'OWNER') {
        this.logger.logWithMetadata('debug', 'Owner can grant any permission', {
          granterId,
          permissionCount: permissions.length,
        });
        return {
          valid: true,
          missingPermissions: [],
        };
      }

      // Workers cannot grant any permissions (Requirement 5.3)
      if (granter.hierarchyLevel === 'WORKER') {
        this.logger.logWithMetadata('warn', 'Worker attempted to grant permissions', {
          granterId,
        });
        return {
          valid: false,
          missingPermissions: permissions,
          message: 'Workers cannot grant permissions',
        };
      }

      // For managers, check they have all permissions being granted (Requirement 5.1, 5.3)
      const granterPermissions = await this.permissionCacheService.getPermissions(granterId);
      const missingPermissions: ModulePermission[] = [];

      for (const permission of permissions) {
        const granterActions = granterPermissions.modules[permission.module] || [];
        const missingActions = permission.actions.filter(
          action => !granterActions.includes(action),
        );

        if (missingActions.length > 0) {
          missingPermissions.push({
            module: permission.module,
            actions: missingActions,
          });
        }
      }

      if (missingPermissions.length > 0) {
        this.logger.logWithMetadata('warn', 'Delegation validation failed', {
          granterId,
          missingPermissions,
        });
        return {
          valid: false,
          missingPermissions,
          message: 'Granter does not have all permissions being granted',
        };
      }

      this.logger.logWithMetadata('debug', 'Delegation validation passed', {
        granterId,
        permissionCount: permissions.length,
      });

      return {
        valid: true,
        missingPermissions: [],
      };
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error validating delegation', {
        granterId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   * 
   * @param userId - User ID
   * @param module - Module name
   * @param action - Action name
   * @returns True if user has the permission
   */
  async hasPermission(
    userId: string,
    module: string,
    action: string,
  ): Promise<boolean> {
    try {
      const permissions = await this.permissionCacheService.getPermissions(userId);
      const actions = permissions.modules[module] || [];
      return actions.includes(action);
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error checking permission', {
        userId,
        module,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get all grantable permissions for a user
   * 
   * @param userId - User ID
   * @returns Permission set that user can grant
   */
  async getGrantablePermissions(userId: string) {
    try {
      const user = await this.prismaService.users.findUnique({
        where: { id: userId },
        select: {
          hierarchyLevel: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Owners can grant any permission
      if (user.hierarchyLevel === 'OWNER') {
        // Return all possible permissions (would need MODULE_REGISTRY)
        return await this.permissionCacheService.getPermissions(userId);
      }

      // Workers cannot grant any permissions
      if (user.hierarchyLevel === 'WORKER') {
        return {
          modules: {},
          fingerprint: '',
        };
      }

      // Managers can grant permissions they have
      return await this.permissionCacheService.getPermissions(userId);
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error getting grantable permissions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
