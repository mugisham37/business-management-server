import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ICacheService } from './interfaces/cache.interface';

/**
 * Multi-tier cache service with memory and Redis layers
 * Provides fallback from memory → Redis → database
 */
@Injectable()
export class MultiTierCacheService implements ICacheService {
  private readonly logger = new Logger(MultiTierCacheService.name);
  private readonly memoryCache: Map<string, { value: any; expiresAt: number }> =
    new Map();
  private readonly defaultMemoryTtl = 60; // 1 minute in memory by default

  constructor(private readonly redisService: RedisService) {
    // Start cleanup interval for expired memory cache entries
    this.startMemoryCacheCleanup();
  }

  /**
   * Get value with multi-tier fallback
   * Checks memory cache → Redis cache → returns null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Tier 1: Check memory cache
      const memoryValue = this.getFromMemory<T>(key);
      if (memoryValue !== null) {
        this.logger.debug(`Memory cache hit for key: ${key}`);
        return memoryValue;
      }

      // Tier 2: Check Redis cache
      const redisValue = await this.redisService.get<T>(key);
      if (redisValue !== null) {
        this.logger.debug(`Redis cache hit for key: ${key}`);
        // Populate memory cache
        this.setInMemory(key, redisValue, this.defaultMemoryTtl);
        return redisValue;
      }

      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error in multi-tier get for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in both memory and Redis caches
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // Set in memory cache
      const memoryTtl = Math.min(ttl || this.defaultMemoryTtl, this.defaultMemoryTtl);
      this.setInMemory(key, value, memoryTtl);

      // Set in Redis cache
      await this.redisService.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Error in multi-tier set for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete value from both memory and Redis caches
   */
  async del(key: string): Promise<void> {
    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from Redis cache
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Error in multi-tier del for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern from both caches
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // Delete from memory cache
      const regex = this.patternToRegex(pattern);
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }

      // Delete from Redis cache
      await this.redisService.delPattern(pattern);
    } catch (error) {
      this.logger.error(`Error in multi-tier delPattern for ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists in either cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      // Check memory cache first
      if (this.memoryCache.has(key)) {
        const entry = this.memoryCache.get(key);
        if (entry && entry.expiresAt > Date.now()) {
          return true;
        }
      }

      // Check Redis cache
      return await this.redisService.exists(key);
    } catch (error) {
      this.logger.error(`Error in multi-tier exists for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL from Redis (memory cache has fixed TTL)
   */
  async ttl(key: string): Promise<number> {
    return this.redisService.ttl(key);
  }

  /**
   * Get multiple values with multi-tier fallback
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    const missingKeys: string[] = [];
    const missingIndices: number[] = [];

    // Check memory cache for all keys
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const memoryValue = this.getFromMemory<T>(key);
      if (memoryValue !== null) {
        results[i] = memoryValue;
      } else {
        results[i] = null;
        missingKeys.push(key);
        missingIndices.push(i);
      }
    }

    // Fetch missing keys from Redis
    if (missingKeys.length > 0) {
      const redisValues = await this.redisService.mget<T>(missingKeys);
      for (let i = 0; i < redisValues.length; i++) {
        const value = redisValues[i];
        const originalIndex = missingIndices[i];
        results[originalIndex] = value;

        // Populate memory cache for found values
        if (value !== null) {
          this.setInMemory(missingKeys[i], value, this.defaultMemoryTtl);
        }
      }
    }

    return results;
  }

  /**
   * Set multiple values in both caches
   */
  async mset(entries: Record<string, any>, ttl?: number): Promise<void> {
    try {
      // Set in memory cache
      const memoryTtl = Math.min(ttl || this.defaultMemoryTtl, this.defaultMemoryTtl);
      for (const [key, value] of Object.entries(entries)) {
        this.setInMemory(key, value, memoryTtl);
      }

      // Set in Redis cache
      await this.redisService.mset(entries, ttl);
    } catch (error) {
      this.logger.error('Error in multi-tier mset:', error);
      throw error;
    }
  }

  /**
   * Increment value (Redis only, not in memory)
   */
  async incr(key: string): Promise<number> {
    // Remove from memory cache to avoid inconsistency
    this.memoryCache.delete(key);
    return this.redisService.incr(key);
  }

  /**
   * Decrement value (Redis only, not in memory)
   */
  async decr(key: string): Promise<number> {
    // Remove from memory cache to avoid inconsistency
    this.memoryCache.delete(key);
    return this.redisService.decr(key);
  }

  /**
   * Reset both memory and Redis caches
   */
  async reset(): Promise<void> {
    this.memoryCache.clear();
    await this.redisService.reset();
    this.logger.log('Multi-tier cache reset');
  }

  /**
   * Warm cache with critical data
   * Loads data into both memory and Redis caches
   */
  async warmCache<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number,
  ): Promise<void> {
    try {
      const value = await loader();
      await this.set(key, value, ttl);
      this.logger.log(`Cache warmed for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error warming cache for key ${key}:`, error);
    }
  }

  /**
   * Get value from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in memory cache
   */
  private setInMemory(key: string, value: any, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * Convert pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Start periodic cleanup of expired memory cache entries
   */
  private startMemoryCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryCache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned ${cleanedCount} expired memory cache entries`);
      }
    }, 60000); // Run every minute
  }

  /**
   * Get memory cache statistics
   */
  getMemoryCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()),
    };
  }
}
