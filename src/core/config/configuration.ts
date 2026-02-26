/**
 * Type-safe configuration structure
 * Provides nested configuration objects with full TypeScript support
 */
export interface AppConfig {
  app: {
    name: string;
    port: number;
    environment: 'development' | 'staging' | 'production';
    apiPrefix: string;
  };
  database: {
    url: string;
    poolSize: number;
    connectionTimeout: number;
    readReplicaUrl?: string;
  };
  cache: {
    host: string;
    port: number;
    password?: string;
    ttl: number;
    maxMemory: string;
  };
  queue: {
    host: string;
    port: number;
    password?: string;
    defaultJobAttempts: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    bcryptRounds: number;
  };
  api: {
    graphql: {
      enabled: boolean;
      playground: boolean;
      introspection: boolean;
    };
    grpc: {
      enabled: boolean;
      url: string;
    };
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  };
}

/**
 * Configuration factory function
 * Loads and structures environment variables into typed configuration object
 */
export default (): AppConfig => ({
  app: {
    name: process.env.APP_NAME || 'NestJS ERP',
    port: parseInt(process.env.PORT || '3000', 10),
    environment: (process.env.NODE_ENV ||
      'development') as AppConfig['app']['environment'],
    apiPrefix: process.env.API_PREFIX || 'api',
  },
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    connectionTimeout: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT || '30000',
      10,
    ),
    readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL,
  },
  cache: {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    maxMemory: process.env.CACHE_MAX_MEMORY || '100mb',
  },
  queue: {
    host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST!,
    port: parseInt(
      process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379',
      10,
    ),
    password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
    defaultJobAttempts: parseInt(
      process.env.QUEUE_DEFAULT_JOB_ATTEMPTS || '3',
      10,
    ),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },
  api: {
    graphql: {
      enabled: process.env.GRAPHQL_ENABLED !== 'false',
      playground: process.env.GRAPHQL_PLAYGROUND !== 'false',
      introspection: process.env.GRAPHQL_INTROSPECTION !== 'false',
    },
    grpc: {
      enabled: process.env.GRPC_ENABLED !== 'false',
      url: process.env.GRPC_URL || '0.0.0.0:5000',
    },
  },
  logging: {
    level: (process.env.LOG_LEVEL ||
      'info') as AppConfig['logging']['level'],
  },
});
