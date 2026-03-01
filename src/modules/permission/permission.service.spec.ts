import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionCacheService } from './permission-cache.service';
import { DelegationValidatorService } from './delegation-validator.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('PermissionService', () => {
  let service: PermissionService;
  let prismaService: jest.Mocked<PrismaService>;
  let permissionCacheService: jest.Mocked<PermissionCacheService>;
  let delegationValidatorService: jest.Mocked<DelegationValidatorService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockPrismaService = {
      users: {
        findUnique: jest.fn(),
      },
      permission_matrices: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      permission_snapshots: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockPermissionCacheService = {
      getPermissions: jest.fn(),
      invalidateCache: jest.fn(),
      invalidateCacheBulk: jest.fn(),
    };

    const mockDelegationValidatorService = {
      validateDelegation: jest.fn(),
    };

    const mockLoggerService = {
      setContext: jest.fn(),
      logWithMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionCacheService, useValue: mockPermissionCacheService },
        { provide: DelegationValidatorService, useValue: mockDelegationValidatorService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    prismaService = module.get(PrismaService);
    permissionCacheService = module.get(PermissionCacheService);
    delegationValidatorService = module.get(DelegationValidatorService);
    loggerService = module.get(LoggerService);
  });

  describe('grantPermissions', () => {
    it('should grant permissions with valid delegation', async () => {
      delegationValidatorService.validateDelegation.mockResolvedValue({
        valid: true,
        missingPermissions: [],
      });

      prismaService.users.findUnique.mockResolvedValue({
        id: 'user-id',
        organizationId: 'org-id',
      } as any);

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: { INVENTORY: ['CREATE', 'READ'] },
        fingerprint: 'hash',
      });

      await service.grantPermissions(
        {
          userId: 'user-id',
          permissions: [{ module: 'INVENTORY', actions: ['CREATE', 'READ'] }],
        },
        'granter-id',
      );

      expect(prismaService.permission_matrices.upsert).toHaveBeenCalled();
      expect(prismaService.permission_snapshots.create).toHaveBeenCalled();
      expect(permissionCacheService.invalidateCache).toHaveBeenCalledWith('user-id');
    });

    it('should throw ForbiddenException if delegation validation fails', async () => {
      delegationValidatorService.validateDelegation.mockResolvedValue({
        valid: false,
        missingPermissions: [{ module: 'INVENTORY', actions: ['DELETE'] }],
        message: 'Missing permissions',
      });

      await expect(
        service.grantPermissions(
          {
            userId: 'user-id',
            permissions: [{ module: 'INVENTORY', actions: ['DELETE'] }],
          },
          'granter-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if recipient not found', async () => {
      delegationValidatorService.validateDelegation.mockResolvedValue({
        valid: true,
        missingPermissions: [],
      });

      prismaService.users.findUnique.mockResolvedValue(null);

      await expect(
        service.grantPermissions(
          {
            userId: 'invalid-id',
            permissions: [{ module: 'INVENTORY', actions: ['READ'] }],
          },
          'granter-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokePermissions', () => {
    it('should revoke permissions and cascade', async () => {
      prismaService.permission_matrices.updateMany.mockResolvedValue({ count: 1 } as any);
      prismaService.permission_matrices.findMany.mockResolvedValue([]);
      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {},
        fingerprint: 'hash',
      });

      await service.revokePermissions(
        {
          userId: 'user-id',
          modules: ['INVENTORY'],
        },
        'revoker-id',
      );

      expect(prismaService.permission_matrices.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          module: { in: ['INVENTORY'] },
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
      expect(prismaService.permission_snapshots.create).toHaveBeenCalled();
      expect(permissionCacheService.invalidateCache).toHaveBeenCalledWith('user-id');
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions from cache', async () => {
      const mockPermissions = {
        modules: { INVENTORY: ['READ'] },
        fingerprint: 'hash',
      };

      permissionCacheService.getPermissions.mockResolvedValue(mockPermissions);

      const result = await service.getUserPermissions('user-id');

      expect(result).toEqual(mockPermissions);
      expect(permissionCacheService.getPermissions).toHaveBeenCalledWith('user-id');
    });
  });

  describe('createSnapshot', () => {
    it('should create permission snapshot', async () => {
      permissionCacheService.getPermissions.mockResolvedValue({
        modules: { INVENTORY: ['READ'] },
        fingerprint: 'hash',
      });

      await service.createSnapshot('user-id', 'PERMISSION_GRANT');

      expect(prismaService.permission_snapshots.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-id',
          reason: 'PERMISSION_GRANT',
          fingerprintHash: 'hash',
        }),
      });
    });

    it('should not throw if snapshot creation fails', async () => {
      permissionCacheService.getPermissions.mockRejectedValue(new Error('Cache error'));

      await expect(service.createSnapshot('user-id', 'TEST')).resolves.not.toThrow();
    });
  });

  describe('cascadeRevokePermissions', () => {
    it('should recursively revoke subordinate permissions', async () => {
      // First level subordinates
      prismaService.permission_matrices.findMany
        .mockResolvedValueOnce([
          {
            id: 'perm-1',
            userId: 'subordinate-1',
            module: 'INVENTORY',
            actions: ['READ'],
          },
        ] as any)
        .mockResolvedValueOnce([]); // No more subordinates

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {},
        fingerprint: 'hash',
      });

      await service.cascadeRevokePermissions('user-id', ['INVENTORY']);

      expect(prismaService.permission_matrices.update).toHaveBeenCalled();
      expect(prismaService.permission_snapshots.create).toHaveBeenCalled();
      expect(permissionCacheService.invalidateCacheBulk).toHaveBeenCalled();
    });

    it('should handle no subordinate permissions', async () => {
      prismaService.permission_matrices.findMany.mockResolvedValue([]);

      await service.cascadeRevokePermissions('user-id', ['INVENTORY']);

      expect(prismaService.permission_matrices.update).not.toHaveBeenCalled();
    });
  });

  describe('getPermissionHistory', () => {
    it('should return permission snapshots ordered by date', async () => {
      const mockSnapshots = [
        {
          id: 'snap-1',
          userId: 'user-id',
          snapshotData: { INVENTORY: ['READ'] },
          fingerprintHash: 'hash1',
          reason: 'PERMISSION_GRANT',
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'snap-2',
          userId: 'user-id',
          snapshotData: { INVENTORY: ['READ', 'CREATE'] },
          fingerprintHash: 'hash2',
          reason: 'PERMISSION_GRANT',
          createdAt: new Date('2024-01-01'),
        },
      ];

      prismaService.permission_snapshots.findMany.mockResolvedValue(mockSnapshots as any);

      const result = await service.getPermissionHistory('user-id');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('snap-1');
      expect(prismaService.permission_snapshots.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
