import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionCacheService, PermissionSet } from './permission-cache.service';
import { DelegationValidatorService, ModulePermission } from './delegation-validator.service';

/**
 * DTO for granting permissions
 */
export interface GrantPermissionDto {
  userId: string;
  permissions: ModulePermission[];
}

/**
 * DTO for revoking permissions
 */
export interface RevokePermissionDto {
  userId: string;
  modules: string[];
}

/**
 * Permission snapshot structure
 */
export interface PermissionSnapshot {
  id: string;
  userId: string;
  snapshotData: any;
  fingerprintHash: string;
  reason: string;
  createdAt: Date;
}

/**
 * Service for managing permissions
 * Handles permission grants, revocations, snapshots, and cascade operations
 * 
 * Requirements: 5.4, 5.5, 5.6, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
@Injectable()
export class PermissionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionCacheService: PermissionCacheService,
    private readonly delegationValidatorService: DelegationValidatorService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PermissionService');
  }

  /**
   * Grant permissions to a user with delegation validation
   * Requirements: 5.4, 5.5, 5.6
   * 
   * @param dto - Grant permission DTO
   * @param granterId - User ID of the granter
   */
  async grantPermissions(dto: GrantPermissionDto, granterId: string): Promise<void> {
    try {
      // Validate delegation (Requirement 5.4)
      const validation = await this.delegationValidatorService.validateDelegation(
        granterId,
        dto.permissions,
      );

      if (!validation.valid) {
        this.logger.logWithMetadata('warn', 'Permission grant denied - delegation validation failed', {
          granterId,
          userId: dto.userId,
          missingPermissions: validation.missingPermissions,
        });
        throw new ForbiddenException(
          validation.message || 'You do not have permission to grant these permissions',
        );
      }

      // Verify recipient user exists
      const recipient = await this.prismaService.users.findUnique({
        where: { id: dto.userId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!recipient) {
        throw new BadRequestException('Recipient user not found');
      }

      // Grant permissions (Requirement 5.4)
      await this.prismaService.$transaction(async (tx) => {
        for (const permission of dto.permissions) {
          // Upsert permission matrix (create or update if exists)
          await tx.permission_matrices.upsert({
            where: {
              userId_module: {
                userId: dto.userId,
                module: permission.module,
              },
            },
            create: {
              id: this.generateId(),
              userId: dto.userId,
              organizationId: recipient.organizationId,
              module: permission.module,
              actions: permission.actions,
              grantedById: granterId,
              grantedAt: new Date(),
              revokedAt: null,
            },
            update: {
              actions: permission.actions,
              grantedById: granterId,
              grantedAt: new Date(),
              revokedAt: null, // Un-revoke if previously revoked
            },
          });
        }
      });

      // Create permission snapshot (Requirement 5.5)
      await this.createSnapshot(dto.userId, 'PERMISSION_GRANT');

      // Invalidate cache (Requirement 5.6)
      await this.permissionCacheService.invalidateCache(dto.userId);

      this.logger.logWithMetadata('info', 'Permissions granted', {
        granterId,
        userId: dto.userId,
        permissionCount: dto.permissions.length,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error granting permissions', {
        granterId,
        userId: dto.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Revoke permissions from a user
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   * 
   * @param dto - Revoke permission DTO
   * @param revokerId - User ID of the revoker
   */
  async revokePermissions(dto: RevokePermissionDto, revokerId: string): Promise<void> {
    try {
      // Revoke permissions by setting revokedAt timestamp (Requirement 6.1)
      const now = new Date();
      await this.prismaService.permission_matrices.updateMany({
        where: {
          userId: dto.userId,
          module: {
            in: dto.modules,
          },
          revokedAt: null, // Only revoke active permissions
        },
        data: {
          revokedAt: now,
        },
      });

      // Create permission snapshot (Requirement 6.2)
      await this.createSnapshot(dto.userId, 'PERMISSION_REVOKE');

      // Cascade revoke to subordinates (Requirement 6.3, 6.4)
      await this.cascadeRevokePermissions(dto.userId, dto.modules);

      // Invalidate cache for affected user (Requirement 6.6)
      await this.permissionCacheService.invalidateCache(dto.userId);

      this.logger.logWithMetadata('info', 'Permissions revoked', {
        revokerId,
        userId: dto.userId,
        modules: dto.modules,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error revoking permissions', {
        revokerId,
        userId: dto.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get user's active permissions
   * Requirement 5.8
   * 
   * @param userId - User ID
   * @returns Permission set with modules and fingerprint
   */
  async getUserPermissions(userId: string): Promise<PermissionSet> {
    try {
      return await this.permissionCacheService.getPermissions(userId);
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error getting user permissions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create permission snapshot for audit trail
   * Requirement 5.5, 6.2, 6.5
   * 
   * @param userId - User ID
   * @param reason - Reason for snapshot (PERMISSION_GRANT, PERMISSION_REVOKE, etc.)
   */
  async createSnapshot(userId: string, reason: string): Promise<void> {
    try {
      // Get current permissions
      const permissions = await this.permissionCacheService.getPermissions(userId);

      // Create snapshot
      await this.prismaService.permission_snapshots.create({
        data: {
          id: this.generateId(),
          userId,
          snapshotData: permissions.modules,
          fingerprintHash: permissions.fingerprint,
          reason,
          createdAt: new Date(),
        },
      });

      this.logger.logWithMetadata('debug', 'Permission snapshot created', {
        userId,
        reason,
        fingerprint: permissions.fingerprint,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error creating permission snapshot', {
        userId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - snapshot creation failure should not block main operation
    }
  }

  /**
   * Cascade revoke permissions to subordinates recursively
   * Requirements: 6.3, 6.4, 6.5, 6.6
   * 
   * @param userId - User ID whose permissions were revoked
   * @param modules - Modules that were revoked
   */
  async cascadeRevokePermissions(userId: string, modules: string[]): Promise<void> {
    try {
      // Find all users who received permissions from this user for these modules
      const subordinatePermissions = await this.prismaService.permission_matrices.findMany({
        where: {
          grantedById: userId,
          module: {
            in: modules,
          },
          revokedAt: null, // Only active permissions
        },
        select: {
          id: true,
          userId: true,
          module: true,
          actions: true,
        },
      });

      if (subordinatePermissions.length === 0) {
        this.logger.logWithMetadata('debug', 'No subordinate permissions to cascade revoke', {
          userId,
          modules,
        });
        return;
      }

      const now = new Date();
      const affectedUserIds = new Set<string>();

      // Revoke subordinate permissions (Requirement 6.4)
      await this.prismaService.$transaction(async (tx) => {
        for (const permission of subordinatePermissions) {
          await tx.permission_matrices.update({
            where: { id: permission.id },
            data: { revokedAt: now },
          });

          affectedUserIds.add(permission.userId);
        }
      });

      // Create snapshots for affected users (Requirement 6.5)
      const affectedUserIdArray = Array.from(affectedUserIds);
      for (const affectedUserId of affectedUserIdArray) {
        await this.createSnapshot(affectedUserId, 'CASCADE_REVOKE');
      }

      // Invalidate cache for all affected users (Requirement 6.6)
      await this.permissionCacheService.invalidateCacheBulk(affectedUserIdArray);

      // Recursively cascade to next level (Requirement 6.3)
      for (const affectedUserId of affectedUserIdArray) {
        await this.cascadeRevokePermissions(affectedUserId, modules);
      }

      this.logger.logWithMetadata('info', 'Cascade revocation completed', {
        userId,
        modules,
        affectedUserCount: affectedUserIds.size,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error in cascade revocation', {
        userId,
        modules,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get permission history for a user
   * Requirement 5.8
   * 
   * @param userId - User ID
   * @returns Array of permission snapshots
   */
  async getPermissionHistory(userId: string): Promise<PermissionSnapshot[]> {
    try {
      const snapshots = await this.prismaService.permission_snapshots.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return snapshots.map(snapshot => ({
        id: snapshot.id,
        userId: snapshot.userId,
        snapshotData: snapshot.snapshotData,
        fingerprintHash: snapshot.fingerprintHash,
        reason: snapshot.reason,
        createdAt: snapshot.createdAt,
      }));
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error getting permission history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate unique ID for database records
   * Private helper method
   * 
   * @returns UUID string
   */
  private generateId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }
}
