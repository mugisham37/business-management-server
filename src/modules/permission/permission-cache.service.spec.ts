import { Test, TestingModule } from '@nestjs/testing';
import { PermissionCacheService, PermissionSet } from './permission-cache.service';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';

describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let redisService: jest.Mocked<RedisService>;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockUserId = 'user-123';
  const mockPermissions: PermissionSet = {
    modules: {
      INVENTORY: ['CREATE', 'READ', 'UPDATE'],
      SALES: ['READ', 'CREATE'],
    },
    fingerprint: 'abc123def456',
  };

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockPrismaService = {
      permission_matrices: {
        findMany: jest.fn(),
      },
    };

    const mockLoggerService = {
      setContext: jest.fn(),
      logWithMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCacheService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<PermissionCacheService>(PermissionCacheService);
    redisService = module.get(RedisService);
    prismaService = module.get(PrismaService);
    loggerService = module.get(LoggerService);
  });

  describe('getCacheKey', () => {
    it('should generate correct cache key format', () => {
      const key = service.getCacheKey(mockUserId);
      expect(key).toBe('permissions:user-123');
    });
  });

  describe('getPermissions', () => {
    it('should return cached permissions on cache hit', async () => {
      redisService.get.mockResolvedValue(mockPermissions);

      const result = await service.getPermissions(mockUserId);

      expect(result).toEqual(mockPermissions);
      expect(redisService.get).toHaveBeenCalledWith('permissions:user-123');
      expect(prismaService.permission_matrices.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss and cache result', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.permission_matrices.findMany.mockResolvedValue([
        { module: 'INVENTORY', actions: ['CREATE', 'READ', 'UPDATE'] },
        { module: 'SALES', actions: ['CREATE', 'READ'] },
      ]);

      const result = await service.getPermissions(mockUserId);

      expect(result.modules).toEqual({
        INVENTORY: ['CREATE', 'READ', 'UPDATE'],
        SALES: ['CREATE', 'READ'],
      });
      expect(result.fingerprint).toBeDefined();
      expect(redisService.get).toHaveBeenCalledWith('permissions:user-123');
      expect(prismaService.permission_matrices.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, revokedAt: null },
        select: { module: true, actions: true },
      });
      expect(redisService.set).toHaveBeenCalledWith(
        'permissions:user-123',
        expect.objectContaining({
          modules: {
            INVENTORY: ['CREATE', 'READ', 'UPDATE'],
            SALES: ['CREATE', 'READ'],
          },
        }),
        300,
      );
    });

    it('should fallback to database if Redis fails', async () => {
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));
      prismaService.permission_matrices.findMany.mockResolvedValue([
        { module: 'INVENTORY', actions: ['CREATE', 'READ'] },
      ]);

      const result = await service.getPermissions(mockUserId);

      expect(result.modules).toEqual({ INVENTORY: ['CREATE', 'READ'] });
      expect(prismaService.permission_matrices.findMany).toHaveBeenCalled();
    });
  });

  describe('setPermissions', () => {
    it('should cache permissions with 5-minute TTL', async () => {
      await service.setPermissions(mockUserId, mockPermissions);

      expect(redisService.set).toHaveBeenCalledWith(
        'permissions:user-123',
        mockPermissions,
        300,
      );
    });

    it('should not throw if Redis fails', async () => {
      redisService.set.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.setPermissions(mockUserId, mockPermissions),
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache entry for user', async () => {
      await service.invalidateCache(mockUserId);

      expect(redisService.del).toHaveBeenCalledWith('permissions:user-123');
    });

    it('should not throw if Redis fails', async () => {
      redisService.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateCache(mockUserId),
      ).resolves.not.toThrow();
    });
  });

  describe('invalidateCacheBulk', () => {
    it('should invalidate cache for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      await service.invalidateCacheBulk(userIds);

      expect(redisService.del).toHaveBeenCalledTimes(3);
      expect(redisService.del).toHaveBeenCalledWith('permissions:user-1');
      expect(redisService.del).toHaveBeenCalledWith('permissions:user-2');
      expect(redisService.del).toHaveBeenCalledWith('permissions:user-3');
    });

    it('should handle empty array', async () => {
      await service.invalidateCacheBulk([]);

      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should not throw if some invalidations fail', async () => {
      redisService.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.invalidateCacheBulk(['user-1', 'user-2']),
      ).resolves.not.toThrow();
    });
  });
});
