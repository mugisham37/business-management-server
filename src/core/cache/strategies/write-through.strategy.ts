import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { ICacheStrategy } from '../interfaces/cache-strategy.interface';

/**
 * Write-Through Strategy
 * 
 * Read Flow:
 * 1. Check cache for data
 * 2. If cache hit, return cached data
 * 3. If cache miss, load from database
 * 4. Populate cache with loaded data
 * 5. Return data
 * 
 * Write Flow:
 * 1. Write to cache
 * 2. Write to database synchronously
 * 3. Both operations must succeed
 * 
 * Ensures cache and database are always in sync
 */
@Injectable()
export class WriteThroughStrategy implements ICacheStrategy {
  private readonly logger = new Logger(WriteThroughStrategy.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get value using write-through strategy
   * Same as cache-aside for reads
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

      // Populate cache
      await this.redisService.set(key, value, ttl);

      return value;
    } catch (error) {
      this.logger.error(`Error in write-through get for key ${key}:`, error);
      // On cache error, fall back to database
      return loader();
    }
  }

  /**
   * Set value using write-through strategy
   * Writes to both cache and database synchronously
   */
  async set<T>(
    key: string,
    value: T,
    persister?: (value: T) => Promise<void>,
    ttl?: number,
  ): Promise<void> {
    try {
      // Write to cache first
      await this.redisService.set(key, value, ttl);

      // Then write to database
      if (persister) {
        try {
          await persister(value);
        } catch (error) {
          // If database write fails, remove from cache to maintain consistency
          await this.redisService.del(key);
          throw error;
        }
      }

      this.logger.debug(`Write-through completed for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error in write-through set for key ${key}:`, error);
      throw error;
    }
  }
}
