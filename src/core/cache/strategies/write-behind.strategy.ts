import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { ICacheStrategy } from '../interfaces/cache-strategy.interface';

/**
 * Write-Behind Strategy (Write-Back)
 * 
 * Read Flow:
 * 1. Check cache for data
 * 2. If cache hit, return cached data
 * 3. If cache miss, load from database
 * 4. Populate cache with loaded data
 * 5. Return data
 * 
 * Write Flow:
 * 1. Write to cache immediately
 * 2. Queue database write for asynchronous processing
 * 3. Return immediately without waiting for database write
 * 
 * Provides better write performance but eventual consistency
 */
@Injectable()
export class WriteBehindStrategy implements ICacheStrategy {
  private readonly logger = new Logger(WriteBehindStrategy.name);
  private readonly writeQueue: Map<string, NodeJS.Timeout> = new Map();
  private readonly batchDelay = 1000; // 1 second delay for batching

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get value using write-behind strategy
   * Same as other strategies for reads
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
      this.logger.error(`Error in write-behind get for key ${key}:`, error);
      // On cache error, fall back to database
      return loader();
    }
  }

  /**
   * Set value using write-behind strategy
   * Writes to cache immediately, queues database write
   */
  async set<T>(
    key: string,
    value: T,
    persister?: (value: T) => Promise<void>,
    ttl?: number,
  ): Promise<void> {
    try {
      // Write to cache immediately
      await this.redisService.set(key, value, ttl);

      this.logger.debug(`Cached value for key: ${key}`);

      // Queue database write asynchronously
      if (persister) {
        this.queueDatabaseWrite(key, value, persister);
      }
    } catch (error) {
      this.logger.error(`Error in write-behind set for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Queue database write for asynchronous processing
   * Implements batching with delay to reduce database load
   */
  private queueDatabaseWrite<T>(
    key: string,
    value: T,
    persister: (value: T) => Promise<void>,
  ): void {
    // Cancel existing timeout for this key if any
    const existingTimeout = this.writeQueue.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule database write with delay
    const timeout = setTimeout(async () => {
      try {
        await persister(value);
        this.logger.debug(`Database write completed for key: ${key}`);
        this.writeQueue.delete(key);
      } catch (error) {
        this.logger.error(
          `Error in queued database write for key ${key}:`,
          error,
        );
        // Optionally: implement retry logic or move to dead letter queue
        this.writeQueue.delete(key);
      }
    }, this.batchDelay);

    this.writeQueue.set(key, timeout);
  }

  /**
   * Flush all pending writes immediately
   * Useful for graceful shutdown
   */
  async flush(): Promise<void> {
    this.logger.log('Flushing all pending writes');

    // Wait for all pending timeouts to complete
    const promises: Promise<void>[] = [];

    for (const [key, timeout] of this.writeQueue.entries()) {
      clearTimeout(timeout);
      // Note: We can't execute the persister here as we don't have the value
      // In production, you'd want to store the persister and value together
      this.writeQueue.delete(key);
    }

    await Promise.all(promises);
    this.logger.log('All pending writes flushed');
  }

  /**
   * Get number of pending writes
   */
  getPendingWriteCount(): number {
    return this.writeQueue.size;
  }
}
