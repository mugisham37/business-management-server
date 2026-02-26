/**
 * Cache service interface defining core caching operations
 */
export interface ICacheService {
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key Cache key
   */
  del(key: string): Promise<void>;

  /**
   * Delete multiple keys matching a pattern
   * @param pattern Key pattern (e.g., "user:*")
   */
  delPattern(pattern: string): Promise<void>;

  /**
   * Check if a key exists in cache
   * @param key Cache key
   * @returns True if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get time to live for a key
   * @param key Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Get multiple values from cache
   * @param keys Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  mget<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values in cache
   * @param entries Record of key-value pairs
   * @param ttl Time to live in seconds (optional)
   */
  mset(entries: Record<string, any>, ttl?: number): Promise<void>;

  /**
   * Increment a numeric value
   * @param key Cache key
   * @returns New value after increment
   */
  incr(key: string): Promise<number>;

  /**
   * Decrement a numeric value
   * @param key Cache key
   * @returns New value after decrement
   */
  decr(key: string): Promise<number>;

  /**
   * Reset/clear all cache entries
   */
  reset(): Promise<void>;
}
