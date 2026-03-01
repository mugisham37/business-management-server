import { Module, DynamicModule, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheKeyBuilder } from './cache-key.builder';
import { CacheInterceptor } from './cache.interceptor';
import { MultiTierCacheService } from './multi-tier-cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { CacheAsideStrategy } from './strategies/cache-aside.strategy';
import { WriteThroughStrategy } from './strategies/write-through.strategy';
import { WriteBehindStrategy } from './strategies/write-behind.strategy';
import { CacheOptions } from './interfaces/cache-options.interface';
import { LoggerService } from '../logging/logger.service';

/**
 * Cache module providing Redis-based caching services
 */
@Global()
@Module({})
export class CacheModule {
  /**
   * Register cache module with configuration
   */
  static forRoot(options: CacheOptions): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useValue: options,
        },
        LoggerService,
        {
          provide: RedisService,
          useFactory: (cacheOptions: CacheOptions, loggerService: LoggerService) => {
            return new RedisService(cacheOptions, loggerService);
          },
          inject: ['CACHE_OPTIONS', LoggerService],
        },
        CacheKeyBuilder,
        CacheInterceptor,
        MultiTierCacheService,
        CacheInvalidationService,
        TokenBlacklistService,
        CacheAsideStrategy,
        WriteThroughStrategy,
        WriteBehindStrategy,
      ],
      exports: [
        RedisService,
        CacheKeyBuilder,
        CacheInterceptor,
        MultiTierCacheService,
        CacheInvalidationService,
        TokenBlacklistService,
        CacheAsideStrategy,
        WriteThroughStrategy,
        WriteBehindStrategy,
      ],
    };
  }

  /**
   * Register cache module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<CacheOptions> | CacheOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        LoggerService,
        {
          provide: RedisService,
          useFactory: (cacheOptions: CacheOptions, loggerService: LoggerService) => {
            return new RedisService(cacheOptions, loggerService);
          },
          inject: ['CACHE_OPTIONS', LoggerService],
        },
        CacheKeyBuilder,
        CacheInterceptor,
        MultiTierCacheService,
        CacheInvalidationService,
        TokenBlacklistService,
        CacheAsideStrategy,
        WriteThroughStrategy,
        WriteBehindStrategy,
      ],
      exports: [
        RedisService,
        CacheKeyBuilder,
        CacheInterceptor,
        MultiTierCacheService,
        CacheInvalidationService,
        TokenBlacklistService,
        CacheAsideStrategy,
        WriteThroughStrategy,
        WriteBehindStrategy,
      ],
    };
  }
}
