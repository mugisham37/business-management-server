import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { MultiTierCacheService } from './multi-tier-cache.service';
import { CacheKeyBuilder } from './cache-key.builder';

/**
 * Cache invalidation patterns for different entity types
 */
export interface CacheInvalidationPattern {
  /**
   * Entity type (e.g., 'user', 'product')
   */
  entityType: string;

  /**
   * Cache key patterns to invalidate (supports wildcards)
   */
  patterns: string[];
}

/**
 * Domain event interface for cache invalidation
 * This will integrate with the event system once it's implemented
 */
export interface DomainEvent {
  eventName: string;
  aggregateId: string;
  metadata?: Record<string, any>;
}

/**
 * Service for event-based cache invalidation
 * Listens to domain events and invalidates related cache entries
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly invalidationPatterns: Map<string, string[]> = new Map();

  constructor(
    private readonly redisService: RedisService,
    private readonly multiTierCache: MultiTierCacheService,
    private readonly cacheKeyBuilder: CacheKeyBuilder,
  ) {}

  /**
   * Register cache invalidation patterns for an entity type
   * @param entityType Entity type (e.g., 'user', 'product')
   * @param patterns Array of cache key patterns to invalidate
   */
  registerInvalidationPattern(entityType: string, patterns: string[]): void {
    this.invalidationPatterns.set(entityType, patterns);
    this.logger.log(
      `Registered invalidation patterns for ${entityType}: ${patterns.join(', ')}`,
    );
  }

  /**
   * Handle domain event and invalidate related cache entries
   * @param event Domain event
   */
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const entityType = this.extractEntityType(event.eventName);
      const patterns = this.invalidationPatterns.get(entityType);

      if (!patterns || patterns.length === 0) {
        this.logger.debug(
          `No invalidation patterns registered for entity type: ${entityType}`,
        );
        return;
      }

      await this.invalidateByPatterns(patterns, event);
    } catch (error) {
      this.logger.error('Error handling domain event for cache invalidation:', error);
    }
  }

  /**
   * Invalidate cache entries by patterns
   * @param patterns Array of cache key patterns
   * @param event Domain event for context
   */
  async invalidateByPatterns(
    patterns: string[],
    event: DomainEvent,
  ): Promise<void> {
    const invalidationPromises = patterns.map(async (pattern) => {
      try {
        // Replace {{aggregateId}} placeholder with actual ID
        const resolvedPattern = pattern.replace(
          /\{\{aggregateId\}\}/g,
          event.aggregateId,
        );

        // Replace other metadata placeholders
        let finalPattern = resolvedPattern;
        if (event.metadata) {
          for (const [key, value] of Object.entries(event.metadata)) {
            finalPattern = finalPattern.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
              String(value),
            );
          }
        }

        this.logger.debug(
          `Invalidating cache pattern: ${finalPattern} for event: ${event.eventName}`,
        );

        // Invalidate in both memory and Redis caches
        await this.multiTierCache.delPattern(finalPattern);
      } catch (error) {
        this.logger.error(
          `Error invalidating pattern ${pattern}:`,
          error,
        );
      }
    });

    await Promise.all(invalidationPromises);
  }

  /**
   * Invalidate specific cache key
   * @param key Cache key to invalidate
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.multiTierCache.del(key);
      this.logger.debug(`Invalidated cache key: ${key}`);
    } catch (error) {
      this.logger.error(`Error invalidating key ${key}:`, error);
    }
  }

  /**
   * Invalidate multiple cache keys
   * @param keys Array of cache keys to invalidate
   */
  async invalidateMultiple(keys: string[]): Promise<void> {
    const promises = keys.map((key) => this.invalidate(key));
    await Promise.all(promises);
  }

  /**
   * Invalidate all cache entries for an entity
   * @param entityType Entity type
   * @param entityId Entity ID
   */
  async invalidateEntity(entityType: string, entityId: string): Promise<void> {
    const pattern = this.cacheKeyBuilder.buildPattern(entityType, entityId, '*');
    await this.multiTierCache.delPattern(pattern);
    this.logger.debug(`Invalidated all cache for ${entityType}:${entityId}`);
  }

  /**
   * Invalidate all cache entries for an entity type
   * @param entityType Entity type
   */
  async invalidateEntityType(entityType: string): Promise<void> {
    const pattern = this.cacheKeyBuilder.buildPattern(entityType, '*');
    await this.multiTierCache.delPattern(pattern);
    this.logger.debug(`Invalidated all cache for entity type: ${entityType}`);
  }

  /**
   * Extract entity type from event name
   * @param eventName Event name (e.g., 'user.created', 'product.updated')
   * @returns Entity type (e.g., 'user', 'product')
   */
  private extractEntityType(eventName: string): string {
    const parts = eventName.split('.');
    return parts[0] || eventName;
  }

  /**
   * Get all registered invalidation patterns
   */
  getRegisteredPatterns(): Map<string, string[]> {
    return new Map(this.invalidationPatterns);
  }
}
