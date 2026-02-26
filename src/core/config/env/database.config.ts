import { registerAs } from '@nestjs/config';

/**
 * Database configuration
 * Provides database connection and pooling settings
 */
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  connectionTimeout: parseInt(
    process.env.DATABASE_CONNECTION_TIMEOUT || '30000',
    10,
  ),
  readReplicaUrl: process.env.DATABASE_READ_REPLICA_URL,
}));
