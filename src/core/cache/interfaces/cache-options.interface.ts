/**
 * Cache configuration options
 */
export interface CacheOptions {
  /**
   * Redis host
   */
  host: string;

  /**
   * Redis port
   */
  port: number;

  /**
   * Redis password (optional)
   */
  password?: string;

  /**
   * Redis database number (default: 0)
   */
  db?: number;

  /**
   * Default TTL in seconds
   */
  ttl: number;

  /**
   * Maximum memory policy
   */
  maxMemory?: string;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;

  /**
   * Enable retry strategy
   */
  enableRetry?: boolean;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;
}

/**
 * Cacheable decorator options
 */
export interface CacheableOptions {
  /**
   * Cache key pattern (supports {{param}} placeholders)
   */
  key: string;

  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Cache strategy to use
   */
  strategy?: 'cache-aside' | 'write-through' | 'write-behind';

  /**
   * Namespace for the cache key
   */
  namespace?: string;
}
