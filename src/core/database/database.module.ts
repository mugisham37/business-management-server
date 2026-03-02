import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConnectionHealthService } from './connection-health.service';

/**
 * Database Module
 * 
 * Global module that provides Prisma service for database access.
 * Marked as @Global() so it's available throughout the application without explicit imports.
 */
@Global()
@Module({
  providers: [PrismaService, ConnectionHealthService],
  exports: [PrismaService, ConnectionHealthService],
})
export class DatabaseModule {}
