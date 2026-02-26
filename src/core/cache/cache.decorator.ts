import { SetMetadata } from '@nestjs/common';
import { CacheableOptions } from './interfaces/cache-options.interface';

/**
 * Metadata key for cacheable decorator
 */
export const CACHEABLE_METADATA_KEY = 'cacheable';

/**
 * Decorator to mark a method as cacheable
 * Automatically caches method results based on parameters
 * 
 * @param options Caching options including key pattern, TTL, and strategy
 * @example
 * ```typescript
 * @Cacheable({ key: 'user:{{id}}', ttl: 3600 })
 * async getUserById(id: string): Promise<User> {
 *   return this.userRepository.findById(id);
 * }
 * ```
 */
export const Cacheable = (options: CacheableOptions): MethodDecorator => {
  return SetMetadata(CACHEABLE_METADATA_KEY, options);
};
