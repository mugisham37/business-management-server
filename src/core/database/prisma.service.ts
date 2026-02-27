import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './middleware/soft-delete.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { auditMiddleware } from './middleware/audit.middleware';
import { timestampMiddleware } from './middleware/timestamp.middleware';
import { LoggerService } from '../logging/logger.service';

/**
 * Prisma Service
 * 
 * Manages database connections with connection pooling and graceful shutdown.
 * Extends PrismaClient to provide NestJS lifecycle integration.
 * 
 * Features:
 * - Connection pooling via Prisma
 * - Graceful shutdown support
 * - Automatic connection on module init
 * - Automatic disconnection on module destroy
 * - Middleware for soft deletes, tenant isolation, audit logging, and timestamps
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger: LoggerService;

  constructor(loggerService: LoggerService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    this.logger = loggerService;
    this.logger.setContext('PrismaService');

    // Register middleware in order
    // Order matters: timestamp -> tenant -> soft-delete -> audit
    this.$use(timestampMiddleware());
    this.$use(tenantMiddleware());
    this.$use(softDeleteMiddleware());
    this.$use(auditMiddleware(this));

    // Log queries with execution time
    this.$on('query' as never, (e: any) => {
      this.logger.logWithMetadata(
        'debug',
        `Database query executed`,
        {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        },
      );
    });

    // Log errors
    this.$on('error' as never, (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.stack);
    });

    // Log warnings
    this.$on('warn' as never, (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  /**
   * Connect to database on module initialization
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.info('Database connection established');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to connect to database', errorStack);
      throw error;
    }
  }

  /**
   * Disconnect from database on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.info('Database connection closed');
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Error closing database connection', errorStack);
    }
  }

  /**
   * Enable shutdown hooks for graceful shutdown
   * This ensures the database connection is closed when the application shuts down
   * 
   * @param app - NestJS application instance
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', async () => {
      await app.close();
    });

    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT signal, closing application...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM signal, closing application...');
      await app.close();
      process.exit(0);
    });
  }

  /**
   * Health check - ping database
   * @returns true if database is reachable
   */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Database ping failed', errorStack);
      return false;
    }
  }
}
