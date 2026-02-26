import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from './redis.service';
import { CacheKeyBuilder } from './cache-key.builder';
import { CACHEABLE_METADATA_KEY } from './cache.decorator';
import { CacheableOptions } from './interfaces/cache-options.interface';

/**
 * Interceptor for automatic cache management
 * Works with @Cacheable decorator to cache method results
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
    private readonly cacheKeyBuilder: CacheKeyBuilder,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get cacheable metadata from method
    const cacheableOptions = this.reflector.get<CacheableOptions>(
      CACHEABLE_METADATA_KEY,
      context.getHandler(),
    );

    // If method is not cacheable, proceed without caching
    if (!cacheableOptions) {
      return next.handle();
    }

    try {
      // Extract method parameters
      const args = context.getArgs();
      const methodParams = this.extractMethodParams(context, args);

      // Build cache key from pattern and parameters
      const cacheKey = this.buildCacheKey(cacheableOptions, methodParams);

      // Try to get cached value
      const cachedValue = await this.redisService.get(cacheKey);

      if (cachedValue !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cachedValue);
      }

      this.logger.debug(`Cache miss for key: ${cacheKey}`);

      // Execute method and cache result
      return next.handle().pipe(
        tap(async (result) => {
          try {
            await this.redisService.set(
              cacheKey,
              result,
              cacheableOptions.ttl,
            );
            this.logger.debug(`Cached result for key: ${cacheKey}`);
          } catch (error) {
            this.logger.error(
              `Error caching result for key ${cacheKey}:`,
              error,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error in cache interceptor:', error);
      // On error, proceed without caching
      return next.handle();
    }
  }

  /**
   * Extract method parameters from execution context
   */
  private extractMethodParams(
    context: ExecutionContext,
    args: any[],
  ): Record<string, any> {
    const handler = context.getHandler();
    const paramNames = this.getParameterNames(handler);
    const params: Record<string, any> = {};

    // Map parameter names to values
    paramNames.forEach((name, index) => {
      if (index < args.length) {
        params[name] = args[index];
      }
    });

    return params;
  }

  /**
   * Get parameter names from function
   */
  private getParameterNames(func: Function): string[] {
    const funcStr = func.toString();
    const match = funcStr.match(/\(([^)]*)\)/);

    if (!match || !match[1]) {
      return [];
    }

    return match[1]
      .split(',')
      .map((param) => param.trim().split('=')[0].trim())
      .filter((param) => param.length > 0);
  }

  /**
   * Build cache key from options and parameters
   */
  private buildCacheKey(
    options: CacheableOptions,
    params: Record<string, any>,
  ): string {
    const namespace = options.namespace || '';
    let key = options.key;

    // If namespace is provided, prepend it
    if (namespace) {
      key = `${namespace}:${key}`;
    }

    // Replace parameter placeholders in key pattern
    return this.cacheKeyBuilder.buildFromPattern(key, params);
  }
}
