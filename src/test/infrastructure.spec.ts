/**
 * Testing Infrastructure Unit Tests
 * Tests the testing infrastructure without requiring database connection
 */

import { AuthHelper } from './helpers';
import {
  createMock,
  createPartialMock,
  createMockPrismaClient,
  createMockRedisClient,
  createMockQueue,
  createMockEventEmitter,
} from './helpers/mock.helper';

describe('Testing Infrastructure', () => {
  describe('AuthHelper', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper();
    });

    it('should generate valid access token', () => {
      const token = authHelper.generateAccessToken({
        sub: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate and verify access token', () => {
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
        roles: ['admin'],
      };

      const token = authHelper.generateAccessToken(payload);
      const decoded = authHelper.verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });

    it('should generate both access and refresh tokens', () => {
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        tenantId: 'tenant-id',
      };

      const tokens = authHelper.generateTokens(payload);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should hash password', async () => {
      const password = 'TestPassword123!';
      const hash = await authHelper.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(password.length);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await authHelper.hashPassword(password);
      const isValid = await authHelper.comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await authHelper.hashPassword(password);
      const isValid = await authHelper.comparePassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('should generate API key', () => {
      const apiKey = authHelper.generateApiKey();

      expect(apiKey).toBeDefined();
      expect(apiKey).toMatch(/^test_/);
      expect(apiKey.length).toBeGreaterThan(10);
    });

    it('should create authorization header', () => {
      const token = 'test-token-123';
      const header = authHelper.createAuthHeader(token);

      expect(header).toEqual({
        Authorization: 'Bearer test-token-123',
      });
    });

    it('should create test payload with defaults', () => {
      const payload = authHelper.createTestPayload();

      expect(payload.sub).toBe('test-user-id');
      expect(payload.email).toBe('test@example.com');
      expect(payload.tenantId).toBe('test-tenant-id');
      expect(payload.roles).toEqual(['user']);
    });

    it('should create test payload with overrides', () => {
      const payload = authHelper.createTestPayload({
        sub: 'custom-id',
        email: 'custom@example.com',
        roles: ['admin', 'manager'],
      });

      expect(payload.sub).toBe('custom-id');
      expect(payload.email).toBe('custom@example.com');
      expect(payload.roles).toEqual(['admin', 'manager']);
    });
  });

  describe('Mock Helpers', () => {
    it('should create mock Prisma client', () => {
      const mockPrisma = createMockPrismaClient();

      expect(mockPrisma.$connect).toBeDefined();
      expect(mockPrisma.$disconnect).toBeDefined();
      expect(mockPrisma.$transaction).toBeDefined();
      expect(mockPrisma.user).toBeDefined();
      expect(mockPrisma.tenant).toBeDefined();
      expect(jest.isMockFunction(mockPrisma.$connect)).toBe(true);
    });

    it('should create mock Redis client', () => {
      const mockRedis = createMockRedisClient();

      expect(mockRedis.get).toBeDefined();
      expect(mockRedis.set).toBeDefined();
      expect(mockRedis.del).toBeDefined();
      expect(jest.isMockFunction(mockRedis.get)).toBe(true);
    });

    it('should create mock queue', () => {
      const mockQueue = createMockQueue();

      expect(mockQueue.add).toBeDefined();
      expect(mockQueue.process).toBeDefined();
      expect(mockQueue.getJob).toBeDefined();
      expect(jest.isMockFunction(mockQueue.add)).toBe(true);
    });

    it('should create mock event emitter', () => {
      const mockEmitter = createMockEventEmitter();

      expect(mockEmitter.emit).toBeDefined();
      expect(mockEmitter.on).toBeDefined();
      expect(mockEmitter.once).toBeDefined();
      expect(jest.isMockFunction(mockEmitter.emit)).toBe(true);
    });

    it('should create partial mock with implementations', () => {
      const mock = createPartialMock({
        getName: () => 'test-name',
        getValue: () => 42,
      });

      expect(mock.getName).toBeDefined();
      expect(mock.getValue).toBeDefined();
      expect(jest.isMockFunction(mock.getName)).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have LOG_LEVEL set to error', () => {
      expect(process.env.LOG_LEVEL).toBe('error');
    });

    it('should have JWT_SECRET configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET.length).toBeGreaterThan(0);
    });

    it('should have DATABASE_URL configured', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('postgresql://');
    });

    it('should have REDIS_HOST configured', () => {
      expect(process.env.REDIS_HOST).toBeDefined();
    });

    it('should have BCRYPT_ROUNDS configured for fast tests', () => {
      expect(process.env.BCRYPT_ROUNDS).toBe('4');
    });
  });
});
