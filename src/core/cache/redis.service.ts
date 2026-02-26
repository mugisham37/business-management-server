import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ICacheService } from './interfaces/cache.interface';
import type { CacheOptions } from './interfaces/cache-options.interface';

/**
 * Redis service providing connection pooling and cache operations
 */
@Injectable()
export class RedisService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly defaultTtl: number;

  constructor(options: CacheOptions) {
    this.defaultTtl = options.ttl;

    // Create Redis client with connection pooling and retry logic
    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db || 0,
      connectTimeout: options.connectionTimeout || 10000,
      retryStrategy: (times: number) => {
        if (!options.enableRetry) {
          return null;
        }

        const maxRetries = options.maxRetries || 10;
        if (times > maxRetries) {
          this.logger.error(
            `Redis connection failed after ${maxRetries} attempts`,
          );
          return null;
        }

        const delay = options.retryDelay || 1000;
        const retryDelay = Math.min(times * delay, 3000);
        this.logger.warn(
          `Retrying Redis connection (attempt ${times}/${maxRetries}) in ${retryDelay}ms`,
        );
        return retryDelay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    // Connection event handlers
    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting');
    });
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || this.defaultTtl;

      if (ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) {
        return [];
      }

      const values = await this.client.mget(...keys);
      return values.map((value) => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error('Error getting multiple keys:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(entries: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      const ttlSeconds = ttl || this.defaultTtl;

      for (const [key, value] of Object.entries(entries)) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
          pipeline.setex(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Error setting multiple keys:', error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Error decrementing key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Reset/clear all cache entries
   */
  async reset(): Promise<void> {
    try {
      await this.client.flushdb();
      this.logger.log('Cache reset successfully');
    } catch (error) {
      this.logger.error('Error resetting cache:', error);
      throw error;
    }
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis client:', error);
    }
  }
}
