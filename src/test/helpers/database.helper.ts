/**
 * Database Helper for Test Isolation
 * Provides utilities for cleaning and managing test database state
 */

import { PrismaClient } from '@prisma/client';

export class DatabaseHelper {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Clean all tables in the database
   * Deletes all records from all tables in reverse dependency order
   */
  async cleanDatabase(): Promise<void> {
    const tables = [
      'audit_logs',
      'user_roles',
      'role_permissions',
      'users',
      'permissions',
      'roles',
      'tenants',
      'system_config',
    ];

    // Disable foreign key checks temporarily
    await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED;');

    try {
      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" CASCADE;`,
        );
      }
    } finally {
      // Re-enable foreign key checks
      await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE;');
    }
  }

  /**
   * Clean specific tables
   * @param tableNames - Array of table names to clean
   */
  async cleanTables(tableNames: string[]): Promise<void> {
    await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED;');

    try {
      for (const table of tableNames) {
        await this.prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" CASCADE;`,
        );
      }
    } finally {
      await this.prisma.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE;');
    }
  }

  /**
   * Execute a function within a transaction that will be rolled back
   * Useful for test isolation
   */
  async withTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const result = await fn(tx as PrismaClient);
      // Transaction will be rolled back after this block
      throw new Error('ROLLBACK_TEST_TRANSACTION');
    }).catch((error) => {
      if (error.message === 'ROLLBACK_TEST_TRANSACTION') {
        // This is expected, return undefined or handle as needed
        return undefined as T;
      }
      throw error;
    });
  }

  /**
   * Reset database sequences to start from 1
   * Useful after truncating tables
   */
  async resetSequences(): Promise<void> {
    const sequences = await this.prisma.$queryRaw<Array<{ sequencename: string }>>`
      SELECT sequencename 
      FROM pg_sequences 
      WHERE schemaname = 'public'
    `;

    for (const { sequencename } of sequences) {
      await this.prisma.$executeRawUnsafe(
        `ALTER SEQUENCE "${sequencename}" RESTART WITH 1;`,
      );
    }
  }

  /**
   * Check if database is accessible
   */
  async isDatabaseAccessible(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get count of records in a table
   */
  async getTableCount(tableName: string): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "${tableName}"`,
    );
    return Number(result[0].count);
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
