import { Test, TestingModule } from '@nestjs/testing';
import { DelegationValidatorService } from './delegation-validator.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionCacheService } from './permission-cache.service';

describe('DelegationValidatorService', () => {
  let service: DelegationValidatorService;
  let prismaService: jest.Mocked<PrismaService>;
  let permissionCacheService: jest.Mocked<PermissionCacheService>;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockPrismaService = {
      users: {
        findUnique: jest.fn(),
      },
    };

    const mockPermissionCacheService = {
      getPermissions: jest.fn(),
    };

    const mockLoggerService = {
      setContext: jest.fn(),
      logWithMetadata: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationValidatorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionCacheService, useValue: mockPermissionCacheService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    service = module.get<DelegationValidatorService>(DelegationValidatorService);
    prismaService = module.get(PrismaService);
    permissionCacheService = module.get(PermissionCacheService);
    loggerService = module.get(LoggerService);
  });

  describe('validateDelegation', () => {
    it('should allow owners to grant any permission', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        id: 'owner-id',
        hierarchyLevel: 'OWNER',
        organizationId: 'org-id',
      } as any);

      const result = await service.validateDelegation('owner-id', [
        { module: 'INVENTORY', actions: ['CREATE', 'READ'] },
      ]);

      expect(result.valid).toBe(true);
      expect(result.missingPermissions).toEqual([]);
    });

    it('should deny workers from granting any permissions', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        id: 'worker-id',
        hierarchyLevel: 'WORKER',
        organizationId: 'org-id',
      } as any);

      const permissions = [{ module: 'INVENTORY', actions: ['READ'] }];
      const result = await service.validateDelegation('worker-id', permissions);

      expect(result.valid).toBe(false);
      expect(result.missingPermissions).toEqual(permissions);
      expect(result.message).toBe('Workers cannot grant permissions');
    });

    it('should allow managers to grant permissions they have', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        id: 'manager-id',
        hierarchyLevel: 'MANAGER',
        organizationId: 'org-id',
      } as any);

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {
          INVENTORY: ['CREATE', 'READ', 'UPDATE'],
          SALES: ['READ'],
        },
        fingerprint: 'hash',
      });

      const result = await service.validateDelegation('manager-id', [
        { module: 'INVENTORY', actions: ['CREATE', 'READ'] },
      ]);

      expect(result.valid).toBe(true);
      expect(result.missingPermissions).toEqual([]);
    });

    it('should deny managers from granting permissions they do not have', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        id: 'manager-id',
        hierarchyLevel: 'MANAGER',
        organizationId: 'org-id',
      } as any);

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {
          INVENTORY: ['READ'],
        },
        fingerprint: 'hash',
      });

      const result = await service.validateDelegation('manager-id', [
        { module: 'INVENTORY', actions: ['CREATE', 'DELETE'] },
      ]);

      expect(result.valid).toBe(false);
      expect(result.missingPermissions).toEqual([
        { module: 'INVENTORY', actions: ['CREATE', 'DELETE'] },
      ]);
    });

    it('should return invalid if granter not found', async () => {
      prismaService.users.findUnique.mockResolvedValue(null);

      const result = await service.validateDelegation('invalid-id', [
        { module: 'INVENTORY', actions: ['READ'] },
      ]);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Granter user not found');
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has the permission', async () => {
      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {
          INVENTORY: ['CREATE', 'READ'],
        },
        fingerprint: 'hash',
      });

      const result = await service.hasPermission('user-id', 'INVENTORY', 'READ');

      expect(result).toBe(true);
    });

    it('should return false if user does not have the permission', async () => {
      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {
          INVENTORY: ['READ'],
        },
        fingerprint: 'hash',
      });

      const result = await service.hasPermission('user-id', 'INVENTORY', 'DELETE');

      expect(result).toBe(false);
    });

    it('should return false if module not found', async () => {
      permissionCacheService.getPermissions.mockResolvedValue({
        modules: {},
        fingerprint: 'hash',
      });

      const result = await service.hasPermission('user-id', 'SALES', 'READ');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      permissionCacheService.getPermissions.mockRejectedValue(new Error('Cache error'));

      const result = await service.hasPermission('user-id', 'INVENTORY', 'READ');

      expect(result).toBe(false);
    });
  });

  describe('getGrantablePermissions', () => {
    it('should return user permissions for owners', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        hierarchyLevel: 'OWNER',
      } as any);

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: { INVENTORY: ['CREATE', 'READ'] },
        fingerprint: 'hash',
      });

      const result = await service.getGrantablePermissions('owner-id');

      expect(result.modules).toEqual({ INVENTORY: ['CREATE', 'READ'] });
    });

    it('should return empty permissions for workers', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        hierarchyLevel: 'WORKER',
      } as any);

      const result = await service.getGrantablePermissions('worker-id');

      expect(result.modules).toEqual({});
      expect(result.fingerprint).toBe('');
    });

    it('should return user permissions for managers', async () => {
      prismaService.users.findUnique.mockResolvedValue({
        hierarchyLevel: 'MANAGER',
      } as any);

      permissionCacheService.getPermissions.mockResolvedValue({
        modules: { SALES: ['READ'] },
        fingerprint: 'hash',
      });

      const result = await service.getGrantablePermissions('manager-id');

      expect(result.modules).toEqual({ SALES: ['READ'] });
    });

    it('should throw error if user not found', async () => {
      prismaService.users.findUnique.mockResolvedValue(null);

      await expect(service.getGrantablePermissions('invalid-id')).rejects.toThrow(
        'User not found',
      );
    });
  });
});
