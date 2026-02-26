import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { ICacheStrategy } from '../interfaces/cache-strategy.interface';

/**
 * Cache-Aside Strategy (Lazy Loading)
 * 
 * Read Flow:
 * 1. Check cache for data
 * 2. If cache hit, return cached data
 * 3. If cache miss, load from database
 * 4. Populate cache with loaded data
 * 5. Return data
 * 
 * Write Flow:
 * Data is written directly to database, cache is not updated
 * Cache will be populated on next read (lazy loading)
 */
@Injectable()
export class CacheAsideStrategy implements ICacheStrategy {
  private readonly logger = new Logger(CacheAsideStrategy.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get value using cache-aside strategy
   * Checks cache first, loads from database on miss, then populates cache
   */
  async get<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      // Try to get from cache
      const cachedValue = await this.redisService.get<T>(key);

      if (cachedValue !== null) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return cachedValue;
      }

      this.logger.debug(`Cache miss for key: ${key}`);

      // Load from database
      const value = await loader();

      // Populate cache (fire and forget)
      this.redisService.set(key, value, ttl).catch((error) => {
        this.logger.error(`Error populating cache for key ${key}:`, error);
      });

      return value;
    } catch (error) {
      this.logger.error(`Error in cache-aside get for key ${key}:`, error);
      // On cache error, fall back to database
      return loader();
    }
  }

  /**
   * Set value using cache-aside strategy
   * Writes to database only, cache is not updated (will be populated on next read)
   */
  async set<T>(
    key: string,
    value: T,
    persister?: (value: T) => Promise<void>,
    ttl?: number,
  ): Promise<void> {
    try {
      // Write to database
      if (persister) {
        await persister(value);
      }

      // Optionally invalidate cache to ensure fresh data on next read
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Error in cache-aside set for key ${key}:`, error);
      throw error;
    }
  }
}
