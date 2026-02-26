import * as Joi from 'joi';

/**
 * Joi validation schema for environment variables
 * Validates all required configuration on application startup
 */
export const configValidationSchema = Joi.object({
  // Application Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().default(3000).min(1).max(65535),
  API_PREFIX: Joi.string().default('api'),

  // Database Configuration
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_SIZE: Joi.number().default(10).min(1).max(100),
  DATABASE_CONNECTION_TIMEOUT: Joi.number().default(30000).min(1000),
  DATABASE_READ_REPLICA_URL: Joi.string().optional(),

  // Cache Configuration (Redis)
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379).min(1).max(65535),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  CACHE_TTL: Joi.number().default(3600).min(0),
  CACHE_MAX_MEMORY: Joi.string().default('100mb'),

  // Queue Configuration (Bull/Redis)
  QUEUE_REDIS_HOST: Joi.string().default(Joi.ref('REDIS_HOST')),
  QUEUE_REDIS_PORT: Joi.number().default(Joi.ref('REDIS_PORT')),
  QUEUE_REDIS_PASSWORD: Joi.string().optional().allow(''),
  QUEUE_DEFAULT_JOB_ATTEMPTS: Joi.number().default(3).min(1).max(10),

  // Authentication Configuration
  JWT_SECRET: Joi.string().required().min(32),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_ROUNDS: Joi.number().default(10).min(8).max(15),

  // API Configuration
  GRAPHQL_ENABLED: Joi.boolean().default(true),
  GRAPHQL_PLAYGROUND: Joi.boolean().default(true),
  GRAPHQL_INTROSPECTION: Joi.boolean().default(true),
  GRPC_ENABLED: Joi.boolean().default(true),
  GRPC_URL: Joi.string().default('0.0.0.0:5000'),

  // Logging Configuration
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
});
