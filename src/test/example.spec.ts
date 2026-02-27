/**
 * Example Test Suite
 * Demonstrates how to use the testing infrastructure
 */

import { PrismaClient } from '@prisma/client';
import {
  DatabaseHelper,
  AuthHelper,
  setupTestIsolation,
  createTestDatabaseConnection,
} from './helpers';
import { createTenant, createUser } from './factories';
import { createAuthFixture } from './fixtures';

describe('Testing Infrastructure Example', () => {
  let prisma: PrismaClient;
  let dbHelper: DatabaseHelper;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    prisma = createTestDatabaseConnection();
    authHelper = new AuthHelper();
  });

  // Setup test isolation - cleans database before each test
  beforeEach(async () => {
    dbHelper = new DatabaseHelper(prisma);
    await dbHelper.cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Factory Usage', () => {
    it('should create a tenant using factory', async () => {
      const tenant = await createTenant(prisma, {
        name: 'Test Company',
        slug: 'test-company',
      });

      expect(tenant).toBeDefined();
      expect(tenant.name).toBe('Test Company');
      expect(tenant.slug).toBe('test-company');
      expect(tenant.isActive).toBe(true);
    });

    it('should create a user using factory', async () => {
      const tenant = await createTenant(prisma);
      const user = await createUser(prisma, tenant.id, {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('Test');
      expect(user.tenantId).toBe(tenant.id);
    });
  });

  describe('Auth Helper Usage', () => {
    it('should generate valid access token', () => {
      const token = authHelper.generateAccessToken({
        sub: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = authHelper.verifyAccessToken(token);
      expect(decoded.sub).toBe('user-id');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should hash and verify password', async () => {
      const password = 'TestPassword123!';
      const hash = await authHelper.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await authHelper.comparePassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await authHelper.comparePassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Fixture Usage', () => {
    it('should create complete auth fixture', async () => {
      const fixture = await createAuthFixture(prisma);

      expect(fixture.tenant).toBeDefined();
      expect(fixture.admin).toBeDefined();
      expect(fixture.manager).toBeDefined();
      expect(fixture.user).toBeDefined();
      expect(fixture.viewer).toBeDefined();
      expect(fixture.roles).toBeDefined();
      expect(fixture.permissions).toBeDefined();
      expect(fixture.tokens).toBeDefined();

      // Verify tokens work
      const decoded = authHelper.verifyAccessToken(fixture.tokens.admin.accessToken);
      expect(decoded.sub).toBe(fixture.admin.id);
    });
  });

  describe('Database Helper Usage', () => {
    it('should clean database', async () => {
      // Create some data
      await createTenant(prisma);
      await createTenant(prisma);

      let count = await dbHelper.getTableCount('tenants');
      expect(count).toBe(2);

      // Clean database
      await dbHelper.cleanDatabase();

      count = await dbHelper.getTableCount('tenants');
      expect(count).toBe(0);
    });

    it('should check database accessibility', async () => {
      const isAccessible = await dbHelper.isDatabaseAccessible();
      expect(isAccessible).toBe(true);
    });
  });

  describe('Test Isolation', () => {
    it('should isolate test 1', async () => {
      const tenant = await createTenant(prisma, { name: 'Tenant 1' });
      expect(tenant.name).toBe('Tenant 1');

      const count = await dbHelper.getTableCount('tenants');
      expect(count).toBe(1);
    });

    it('should isolate test 2', async () => {
      // This test should start with a clean database
      const count = await dbHelper.getTableCount('tenants');
      expect(count).toBe(0);

      const tenant = await createTenant(prisma, { name: 'Tenant 2' });
      expect(tenant.name).toBe('Tenant 2');
    });
  });
});
