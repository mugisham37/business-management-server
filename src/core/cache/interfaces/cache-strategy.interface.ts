/**
 * Cache strategy interface
 */
export interface ICacheStrategy {
  /**
   * Get value using the strategy
   * @param key Cache key
   * @param loader Function to load data if not in cache
   * @param ttl Time to live in seconds
   */
  get<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T>;

  /**
   * Set value using the strategy
   * @param key Cache key
   * @param value Value to cache
   * @param persister Function to persist data
   * @param ttl Time to live in seconds
   */
  set<T>(
    key: string,
    value: T,
    persister?: (value: T) => Promise<void>,
    ttl?: number,
  ): Promise<void>;
}
