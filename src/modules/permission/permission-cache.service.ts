import { Injectable } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';

/**
 * Permission set structure containing modules and actions
 */
export interface PermissionSet {
  modules: Record<string, string[]>; // module -> actions[]
  fingerprint: string;
}

/**
 * Service for caching user permissions in Redis
 * Implements cache-aside pattern with 5-minute TTL
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
@Injectable()
export class PermissionCacheService {
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly CACHE_KEY_PREFIX = 'permissions';

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PermissionCacheService');
  }

  /**
   * Get permissions from cache or database (cache-aside pattern)
   * Requirement 8.1, 8.2, 8.3
   * 
   * @param userId - User ID to get permissions for
   * @returns Permission set with modules and fingerprint
   */
  async getPermissions(userId: string): Promise<PermissionSet> {
    const cacheKey = this.getCacheKey(userId);

    try {
      // Try to get from cache first (Requirement 8.1)
      const cached = await this.redisService.get<PermissionSet>(cacheKey);
      
      if (cached) {
        // Cache hit (Requirement 8.2)
        this.logger.logWithMetadata('debug', 'Permission cache hit', {
          userId,
          cacheKey,
        });
        return cached;
      }

      // Cache miss - fetch from database (Requirement 8.3)
      this.logger.logWithMetadata('debug', 'Permission cache miss', {
        userId,
        cacheKey,
      });

      const permissions = await this.fetchPermissionsFromDatabase(userId);

      // Store in cache with TTL (Requirement 8.3)
      await this.setPermissions(userId, permissions);

      return permissions;
    } catch (error) {
      // If Redis fails, fall back to database query
      this.logger.logWithMetadata('error', 'Error getting permissions from cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to database
      return await this.fetchPermissionsFromDatabase(userId);
    }
  }

  /**
   * Set permissions in cache with 5-minute TTL
   * Requirement 8.3, 8.6
   * 
   * @param userId - User ID
   * @param permissions - Permission set to cache
   */
  async setPermissions(userId: string, permissions: PermissionSet): Promise<void> {
    const cacheKey = this.getCacheKey(userId);

    try {
      await this.redisService.set(cacheKey, permissions, this.CACHE_TTL);
      
      this.logger.logWithMetadata('debug', 'Permissions cached', {
        userId,
        cacheKey,
        ttl: this.CACHE_TTL,
        moduleCount: Object.keys(permissions.modules).length,
      });
    } catch (error) {
      // Log error but don't throw - caching is not critical
      this.logger.logWithMetadata('error', 'Error setting permissions in cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate cache for a single user
   * Requirement 8.4
   * 
   * @param userId - User ID to invalidate cache for
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = this.getCacheKey(userId);

    try {
      await this.redisService.del(cacheKey);
      
      this.logger.logWithMetadata('debug', 'Permission cache invalidated', {
        userId,
        cacheKey,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error invalidating permission cache', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - cache invalidation failure is not critical
    }
  }

  /**
   * Invalidate cache for multiple users
   * Requirement 8.4
   * 
   * @param userIds - Array of user IDs to invalidate cache for
   */
  async invalidateCacheBulk(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      // Delete all cache keys in parallel
      await Promise.all(
        userIds.map(userId => this.invalidateCache(userId))
      );

      this.logger.logWithMetadata('debug', 'Bulk permission cache invalidation', {
        userCount: userIds.length,
      });
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error in bulk cache invalidation', {
        userCount: userIds.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - cache invalidation failure is not critical
    }
  }

  /**
   * Generate cache key for user permissions
   * Requirement 8.1
   * 
   * @param userId - User ID
   * @returns Cache key string
   */
  getCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}:${userId}`;
  }

  /**
   * Fetch permissions from database and calculate fingerprint
   * Private helper method
   * 
   * @param userId - User ID
   * @returns Permission set with modules and fingerprint
   */
  private async fetchPermissionsFromDatabase(userId: string): Promise<PermissionSet> {
    // Query active permission matrices for the user
    const permissionMatrices = await this.prismaService.permission_matrices.findMany({
      where: {
        userId,
        revokedAt: null, // Only active permissions
      },
      select: {
        module: true,
        actions: true,
      },
    });

    // Build modules map
    const modules: Record<string, string[]> = {};
    
    for (const matrix of permissionMatrices) {
      modules[matrix.module] = matrix.actions;
    }

    // Calculate permission fingerprint (SHA-256 hash)
    const fingerprint = this.calculatePermissionFingerprint(modules);

    return {
      modules,
      fingerprint,
    };
  }

  /**
   * Calculate permission fingerprint using SHA-256
   * Private helper method
   * 
   * @param modules - Modules and actions map
   * @returns SHA-256 hash of permissions
   */
  private calculatePermissionFingerprint(modules: Record<string, string[]>): string {
    // Sort modules and actions for consistent hashing
    const sortedModules = Object.keys(modules).sort();
    const permissionString = sortedModules
      .map(module => {
        const sortedActions = modules[module].sort();
        return `${module}:${sortedActions.join(',')}`;
      })
      .join('|');

    // Use Node.js crypto for SHA-256
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(permissionString)
      .digest('hex');
  }
}
