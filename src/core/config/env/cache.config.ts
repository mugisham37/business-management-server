import { registerAs } from '@nestjs/config';

/**
 * Cache configuration
 * Provides Redis cache connection and behavior settings
 */
export default registerAs('cache', () => ({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
  maxMemory: process.env.CACHE_MAX_MEMORY || '100mb',
}));
