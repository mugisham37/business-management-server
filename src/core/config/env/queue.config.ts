import { registerAs } from '@nestjs/config';

/**
 * Queue configuration
 * Provides Bull queue connection and job processing settings
 */
export default registerAs('queue', () => ({
  host: process.env.QUEUE_REDIS_HOST || process.env.REDIS_HOST,
  port: parseInt(
    process.env.QUEUE_REDIS_PORT || process.env.REDIS_PORT || '6379',
    10,
  ),
  password: process.env.QUEUE_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
  defaultJobAttempts: parseInt(
    process.env.QUEUE_DEFAULT_JOB_ATTEMPTS || '3',
    10,
  ),
}));
