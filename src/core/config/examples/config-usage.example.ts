import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config.service';

/**
 * Example service demonstrating configuration module usage
 * This file shows various ways to access and use configuration
 */
@Injectable()
export class ConfigUsageExample {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Example 1: Basic configuration access
   */
  basicUsage() {
    // Get simple value
    const port = this.configService.get<number>('PORT');
    console.log(`Application port: ${port}`);

    // Get with default value
    const apiPrefix = this.configService.get('API_PREFIX', 'api');
    console.log(`API prefix: ${apiPrefix}`);

    // Get or throw if not found
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    console.log(`JWT secret configured: ${!!jwtSecret}`);
  }

  /**
   * Example 2: Nested configuration access
   */
  nestedConfigAccess() {
    const config = this.configService.getAll();

    console.log('Database configuration:', {
      poolSize: config.database.poolSize,
      timeout: config.database.connectionTimeout,
    });

    console.log('Cache configuration:', {
      host: config.cache.host,
      port: config.cache.port,
      ttl: config.cache.ttl,
    });

    console.log('Auth configuration:', {
      jwtExpiry: config.auth.jwtExpiresIn,
      bcryptRounds: config.auth.bcryptRounds,
    });
  }

  /**
   * Example 3: Sensitive value masking for logging
   */
  sensitiveValueMasking() {
    // Get masked value for safe logging
    const maskedSecret = this.configService.getMasked('JWT_SECRET');
    console.log(`JWT Secret (masked): ${maskedSecret}`);

    const maskedDbUrl = this.configService.getMasked('DATABASE_URL');
    console.log(`Database URL (masked): ${maskedDbUrl}`);

    // Get all configuration with sensitive values masked
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const maskedConfig = this.configService.getAllMasked();
    console.log(
      'Full configuration (masked):',
      JSON.stringify(maskedConfig, null, 2),
    );
  }

  /**
   * Example 4: Hot-reloading configuration
   */
  hotReloadExample() {
    // Get list of hot-reloadable keys
    const reloadableKeys = this.configService.getHotReloadableKeys();
    console.log('Hot-reloadable keys:', reloadableKeys);

    // Hot-reload log level
    try {
      this.configService.hotReload('LOG_LEVEL', 'debug');
      console.log('Log level updated to debug');

      const newLogLevel = this.configService.get('LOG_LEVEL');
      console.log(`Current log level: ${newLogLevel}`);
    } catch (error) {
      console.error('Hot-reload failed:', (error as Error).message);
    }

    // Try to hot-reload a non-reloadable key (will throw error)
    try {
      this.configService.hotReload('DATABASE_URL', 'new-url');
    } catch (error) {
      console.log('Expected error:', (error as Error).message);
    }
  }

  /**
   * Example 5: Configuration validation
   */
  validationExample() {
    // Check if a key is sensitive
    console.log(
      'Is JWT_SECRET sensitive?',
      this.configService.isSensitive('JWT_SECRET'),
    );
    console.log('Is PORT sensitive?', this.configService.isSensitive('PORT'));

    // Validate hot-reload value
    try {
      this.configService.hotReload('LOG_LEVEL', 'invalid-level');
    } catch (error) {
      console.log('Validation error:', (error as Error).message);
    }
  }

  /**
   * Example 6: Environment-specific configuration
   */
  environmentSpecificConfig() {
    const config = this.configService.getAll();
    const env = config.app.environment;

    console.log(`Running in ${env} environment`);

    if (env === 'production') {
      console.log('Production mode: GraphQL Playground disabled');
      console.log('Playground enabled:', config.api.graphql.playground);
    } else {
      console.log('Development mode: All debugging tools enabled');
      console.log('Playground enabled:', config.api.graphql.playground);
      console.log('Introspection enabled:', config.api.graphql.introspection);
    }
  }

  /**
   * Example 7: Using configuration in service initialization
   */
  initializeService() {
    const config = this.configService.getAll();

    // Use configuration to initialize external services
    console.log('Initializing services with configuration:');
    console.log(
      `- Database: ${config.database.url ? 'Configured' : 'Not configured'}`,
    );
    console.log(`- Cache: ${config.cache.host}:${config.cache.port}`);
    console.log(`- Queue: ${config.queue.host}:${config.queue.port}`);

    // Example: Configure connection pools based on environment
    const poolSize =
      config.app.environment === 'production'
        ? config.database.poolSize
        : Math.min(config.database.poolSize, 5);

    console.log(`Using connection pool size: ${poolSize}`);
  }
}
