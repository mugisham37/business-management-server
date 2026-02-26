# Configuration Module

The configuration module provides centralized, type-safe configuration management for the NestJS ERP application.

## Features

- **Environment Variable Loading**: Loads configuration from environment variables
- **Validation**: Validates all required variables on application startup using Joi
- **Type Safety**: Full TypeScript type safety for nested configuration objects
- **Sensitive Value Masking**: Automatically masks passwords, secrets, and tokens in logs
- **Hot-Reloading**: Supports runtime configuration updates for non-critical settings
- **Default Values**: Provides sensible defaults for optional configuration
- **Nested Configuration**: Organized configuration by domain (database, cache, queue, auth, api)

## Usage

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@core/config';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    // Get configuration value
    const port = this.configService.get<number>('PORT');
    
    // Get with default value
    const apiPrefix = this.configService.get('API_PREFIX', 'api');
    
    // Get or throw if not found
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    
    // Get nested configuration
    const dbUrl = this.configService.get('database.url');
  }
}
```

### Accessing Nested Configuration

```typescript
// Get entire configuration object
const config = this.configService.getAll();

// Access nested values
const dbPoolSize = config.database.poolSize;
const cacheHost = config.cache.host;
const jwtExpiry = config.auth.jwtExpiresIn;
```

### Sensitive Value Masking

```typescript
// Get masked value for logging
const maskedSecret = this.configService.getMasked('JWT_SECRET');
// Returns: "abc***xyz"

// Get all configuration with sensitive values masked
const maskedConfig = this.configService.getAllMasked();
// Sensitive values are automatically masked
```

### Hot-Reloading Configuration

```typescript
// Hot-reload a non-critical configuration value
this.configService.hotReload('LOG_LEVEL', 'debug');

// Get list of hot-reloadable keys
const reloadableKeys = this.configService.getHotReloadableKeys();
// Returns: ['LOG_LEVEL', 'CACHE_TTL', 'CACHE_MAX_MEMORY', ...]

// Clear hot-reload cache
this.configService.clearHotReloadCache('LOG_LEVEL');
```

## Configuration Structure

### Application Configuration
- `NODE_ENV`: Environment (development, staging, production)
- `PORT`: Application port (default: 3000)
- `API_PREFIX`: API route prefix (default: 'api')

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string (required)
- `DATABASE_POOL_SIZE`: Connection pool size (default: 10)
- `DATABASE_CONNECTION_TIMEOUT`: Connection timeout in ms (default: 30000)
- `DATABASE_READ_REPLICA_URL`: Read replica URL (optional)

### Cache Configuration (Redis)
- `REDIS_HOST`: Redis host (required)
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)
- `CACHE_TTL`: Default cache TTL in seconds (default: 3600)
- `CACHE_MAX_MEMORY`: Max memory for cache (default: '100mb')

### Queue Configuration (Bull)
- `QUEUE_REDIS_HOST`: Queue Redis host (defaults to REDIS_HOST)
- `QUEUE_REDIS_PORT`: Queue Redis port (defaults to REDIS_PORT)
- `QUEUE_REDIS_PASSWORD`: Queue Redis password (optional)
- `QUEUE_DEFAULT_JOB_ATTEMPTS`: Default retry attempts (default: 3)

### Authentication Configuration
- `JWT_SECRET`: JWT signing secret (required, min 32 chars)
- `JWT_EXPIRES_IN`: Access token expiry (default: '15m')
- `REFRESH_TOKEN_EXPIRES_IN`: Refresh token expiry (default: '7d')
- `BCRYPT_ROUNDS`: Password hashing rounds (default: 10)

### API Configuration
- `GRAPHQL_ENABLED`: Enable GraphQL API (default: true)
- `GRAPHQL_PLAYGROUND`: Enable GraphQL Playground (default: true)
- `GRAPHQL_INTROSPECTION`: Enable GraphQL introspection (default: true)
- `GRPC_ENABLED`: Enable gRPC API (default: true)
- `GRPC_URL`: gRPC server URL (default: '0.0.0.0:5000')

### Logging Configuration
- `LOG_LEVEL`: Log level (error, warn, info, debug, verbose) (default: 'info')

## Validation

All configuration is validated on application startup using Joi schemas. If validation fails, the application will not start and will display detailed error messages.

### Validation Rules

- Required fields must be present
- Numeric fields must be within valid ranges
- String fields must match expected formats
- Enum fields must be one of the allowed values

## Hot-Reloadable Configuration

The following configuration keys support hot-reloading without application restart:

- `LOG_LEVEL`: Change log verbosity at runtime
- `CACHE_TTL`: Adjust cache expiration time
- `CACHE_MAX_MEMORY`: Modify cache memory limit
- `QUEUE_DEFAULT_JOB_ATTEMPTS`: Change default retry attempts
- `GRAPHQL_PLAYGROUND`: Enable/disable GraphQL Playground
- `GRAPHQL_INTROSPECTION`: Enable/disable GraphQL introspection

**Note**: Critical configuration like database URLs, secrets, and ports cannot be hot-reloaded and require application restart.

## Sensitive Configuration

The following configuration keys are automatically masked in logs and error messages:

- Any key containing: `password`, `secret`, `token`, `key`
- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_PASSWORD`
- `QUEUE_REDIS_PASSWORD`

## Environment Files

- `.env`: Local development environment variables (not committed)
- `.env.example`: Template with all available configuration options
- `.env.test`: Test environment configuration

## Best Practices

1. **Never commit `.env` files**: Keep sensitive configuration out of version control
2. **Use `.env.example`**: Document all configuration options with examples
3. **Validate early**: Configuration validation happens at startup to fail fast
4. **Use type-safe access**: Leverage TypeScript types for configuration access
5. **Mask sensitive values**: Always use `getMasked()` when logging configuration
6. **Document changes**: Update `.env.example` when adding new configuration
7. **Use defaults wisely**: Provide sensible defaults for optional configuration
8. **Separate concerns**: Use domain-specific configuration files (database.config.ts, etc.)

## Testing

When testing, use the `.env.test` file or override configuration in test setup:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@core/config';

const moduleRef = await Test.createTestingModule({
  imports: [ConfigModule],
})
  .overrideProvider(ConfigService)
  .useValue({
    get: jest.fn((key) => {
      // Return test values
    }),
  })
  .compile();
```

## Troubleshooting

### Application won't start

Check that all required environment variables are set:
- `DATABASE_URL`
- `REDIS_HOST`
- `JWT_SECRET` (must be at least 32 characters)

### Configuration not updating

- Check if the key supports hot-reloading
- Verify the new value passes validation
- Restart the application for non-hot-reloadable keys

### Sensitive values appearing in logs

- Use `getMasked()` or `getAllMasked()` when logging configuration
- Check that the key name contains a sensitive keyword
- Add custom sensitive keys to the `sensitiveKeys` array in ConfigService
