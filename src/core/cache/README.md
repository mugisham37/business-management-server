# Cache Module

Redis-based caching module with multi-tier support, cache strategies, and event-based invalidation.

## Features

- **Redis Service**: Connection pooling, retry logic, and basic cache operations
- **Cache Key Builder**: Hierarchical key generation with pattern-based invalidation
- **Cache Decorator**: Method-level caching with `@Cacheable` decorator
- **Cache Interceptor**: Automatic cache management for decorated methods
- **Multi-Tier Caching**: Memory + Redis fallback for optimal performance
- **Cache Strategies**: Cache-aside, write-through, and write-behind patterns
- **Event-Based Invalidation**: Automatic cache invalidation on domain events

## Installation

The cache module requires `ioredis` and `cache-manager` packages (already installed).

## Configuration

### Basic Setup

```typescript
import { CacheModule } from './core/cache';

@Module({
  imports: [
    CacheModule.forRoot({
      host: 'localhost',
      port: 6379,
      password: 'optional-password',
      ttl: 3600, // Default TTL in seconds
      enableRetry: true,
      maxRetries: 10,
      retryDelay: 1000,
    }),
  ],
})
export class AppModule {}
```

### Async Configuration

```typescript
import { CacheModule } from './core/cache';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        ttl: configService.get('CACHE_TTL'),
        enableRetry: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Usage

### Using the Cache Decorator

```typescript
import { Injectable } from '@nestjs/common';
import { Cacheable } from './core/cache';

@Injectable()
export class UserService {
  @Cacheable({ 
    key: 'user:{{id}}', 
    ttl: 3600,
    namespace: 'users'
  })
  async getUserById(id: string): Promise<User> {
    // This method will be cached automatically
    return this.userRepository.findById(id);
  }

  @Cacheable({ 
    key: 'user:{{email}}:profile', 
    ttl: 1800 
  })
  async getUserByEmail(email: string): Promise<User> {
    return this.userRepository.findByEmail(email);
  }
}
```

### Using Redis Service Directly

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from './core/cache';

@Injectable()
export class MyService {
  constructor(private readonly redisService: RedisService) {}

  async cacheData(): Promise<void> {
    // Set a value
    await this.redisService.set('key', { data: 'value' }, 3600);

    // Get a value
    const value = await this.redisService.get<{ data: string }>('key');

    // Delete a value
    await this.redisService.del('key');

    // Delete by pattern
    await this.redisService.delPattern('user:*');

    // Multiple operations
    await this.redisService.mset({
      'key1': 'value1',
      'key2': 'value2',
    }, 3600);

    const values = await this.redisService.mget(['key1', 'key2']);
  }
}
```

### Using Multi-Tier Cache

```typescript
import { Injectable } from '@nestjs/common';
import { MultiTierCacheService } from './core/cache';

@Injectable()
export class MyService {
  constructor(private readonly cache: MultiTierCacheService) {}

  async getData(key: string): Promise<any> {
    // Checks memory → Redis → returns null
    let data = await this.cache.get(key);

    if (!data) {
      // Load from database
      data = await this.loadFromDatabase();
      
      // Cache in both memory and Redis
      await this.cache.set(key, data, 3600);
    }

    return data;
  }

  async warmCache(): Promise<void> {
    // Pre-load critical data into cache
    await this.cache.warmCache('critical:data', async () => {
      return this.loadCriticalData();
    }, 7200);
  }
}
```

### Using Cache Strategies

```typescript
import { Injectable } from '@nestjs/common';
import { CacheAsideStrategy, WriteThroughStrategy } from './core/cache';

@Injectable()
export class ProductService {
  constructor(
    private readonly cacheAside: CacheAsideStrategy,
    private readonly writeThrough: WriteThroughStrategy,
  ) {}

  async getProduct(id: string): Promise<Product> {
    // Cache-aside: Check cache, load from DB on miss
    return this.cacheAside.get(
      `product:${id}`,
      () => this.productRepository.findById(id),
      3600,
    );
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<void> {
    const product = { ...existingProduct, ...data };
    
    // Write-through: Write to cache and DB synchronously
    await this.writeThrough.set(
      `product:${id}`,
      product,
      (p) => this.productRepository.update(id, p),
      3600,
    );
  }
}
```

### Using Cache Key Builder

```typescript
import { Injectable } from '@nestjs/common';
import { CacheKeyBuilder } from './core/cache';

@Injectable()
export class MyService {
  constructor(private readonly keyBuilder: CacheKeyBuilder) {}

  buildKeys(): void {
    // Build hierarchical keys
    const key1 = this.keyBuilder.build('user', '123', 'profile');
    // Result: 'user:123:profile'

    // Build from pattern
    const key2 = this.keyBuilder.buildFromPattern(
      'user:{{id}}:{{section}}',
      { id: '123', section: 'settings' }
    );
    // Result: 'user:123:settings'

    // Build invalidation pattern
    const pattern = this.keyBuilder.buildPattern('user', '123', '*');
    // Result: 'user:123:*'
  }
}
```

### Using Cache Invalidation

```typescript
import { Injectable } from '@nestjs/common';
import { CacheInvalidationService } from './core/cache';

@Injectable()
export class UserService {
  constructor(
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {
    // Register invalidation patterns
    this.cacheInvalidation.registerInvalidationPattern('user', [
      'user:{{aggregateId}}:*',
      'users:list:*',
    ]);
  }

  async updateUser(id: string, data: Partial<User>): Promise<void> {
    await this.userRepository.update(id, data);

    // Invalidate specific entity
    await this.cacheInvalidation.invalidateEntity('user', id);

    // Or invalidate by pattern
    await this.cacheInvalidation.invalidateEntityType('user');

    // Or handle domain event
    await this.cacheInvalidation.handleDomainEvent({
      eventName: 'user.updated',
      aggregateId: id,
      metadata: { email: data.email },
    });
  }
}
```

## Cache Key Patterns

Use hierarchical keys for better organization:

- `user:123:profile` - User profile
- `user:123:settings` - User settings
- `product:456:details` - Product details
- `order:789:items` - Order items

Use wildcards for pattern-based invalidation:

- `user:*` - All user-related keys
- `user:123:*` - All keys for user 123
- `product:*:details` - All product details

## Best Practices

1. **Use appropriate TTLs**: Short TTL for frequently changing data, long TTL for static data
2. **Use namespaces**: Organize keys by entity type for easier invalidation
3. **Handle cache failures gracefully**: Always fall back to database on cache errors
4. **Invalidate proactively**: Invalidate cache on data updates to avoid stale data
5. **Monitor cache hit rates**: Use cache statistics to optimize caching strategy
6. **Use multi-tier caching**: For frequently accessed data, use memory + Redis
7. **Batch operations**: Use `mget` and `mset` for multiple keys

## Integration with Event System

Once the event system is implemented, the cache invalidation service will automatically listen to domain events and invalidate related cache entries based on registered patterns.

```typescript
// This will be automatic once event system is ready
eventEmitter.emit('user.updated', {
  eventName: 'user.updated',
  aggregateId: userId,
  metadata: { email: newEmail },
});
// Cache will be automatically invalidated based on registered patterns
```

## Testing

The cache module includes comprehensive tests:

- Unit tests for each service
- Property-based tests for correctness properties
- Integration tests for end-to-end flows

Run tests:
```bash
npm test -- cache
npm run test:property -- cache
```

## Performance Considerations

- **Memory cache**: Limited to 1 minute TTL to prevent memory bloat
- **Connection pooling**: Redis client uses connection pooling for efficiency
- **Batch operations**: Use `mget`/`mset` for multiple keys
- **Pattern invalidation**: Use specific patterns to avoid scanning all keys
- **Async operations**: Cache operations are non-blocking

## Troubleshooting

### Redis Connection Issues

Check Redis connection settings and ensure Redis is running:
```bash
redis-cli ping
```

### Cache Not Working

1. Verify cache module is imported in app module
2. Check Redis connection in logs
3. Verify decorator is applied correctly
4. Check TTL is not expired

### Memory Cache Growing

Memory cache automatically cleans up expired entries every minute. If memory usage is high, reduce memory TTL or disable memory tier.
