/**
 * Test Isolation Helper
 * Provides utilities for ensuring test isolation with database cleanup
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseHelper } from './database.helper';

/**
 * Setup test isolation for a test suite
 * Cleans database before each test
 */
export function setupTestIsolation(prisma: PrismaClient): DatabaseHelper {
  const dbHelper = new DatabaseHelper(prisma);

  beforeEach(async () => {
    await dbHelper.cleanDatabase();
  });

  afterAll(async () => {
    await dbHelper.cleanDatabase();
    await dbHelper.disconnect();
  });

  return dbHelper;
}

/**
 * Setup test isolation with transaction rollback
 * Each test runs in a transaction that is rolled back
 */
export function setupTransactionIsolation(prisma: PrismaClient) {
  let testPrisma: PrismaClient;

  beforeEach(async () => {
    // Start a transaction for the test
    await prisma.$executeRaw`BEGIN`;
    testPrisma = prisma;
  });

  afterEach(async () => {
    // Rollback the transaction
    await prisma.$executeRaw`ROLLBACK`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return () => testPrisma;
}

/**
 * Setup test isolation for specific tables
 * Only cleans specified tables before each test
 */
export function setupPartialTestIsolation(
  prisma: PrismaClient,
  tables: string[],
): DatabaseHelper {
  const dbHelper = new DatabaseHelper(prisma);

  beforeEach(async () => {
    await dbHelper.cleanTables(tables);
  });

  afterAll(async () => {
    await dbHelper.cleanTables(tables);
    await dbHelper.disconnect();
  });

  return dbHelper;
}

/**
 * Create a test database connection
 * Returns a new Prisma client for testing
 */
export function createTestDatabaseConnection(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error'],
  });
}

/**
 * Ensure database is ready for testing
 */
export async function ensureDatabaseReady(prisma: PrismaClient): Promise<void> {
  const dbHelper = new DatabaseHelper(prisma);
  const isAccessible = await dbHelper.isDatabaseAccessible();

  if (!isAccessible) {
    throw new Error(
      'Test database is not accessible. Please ensure the database is running and DATABASE_URL is correct.',
    );
  }
}
