import { Test, TestingModule } from '@nestjs/testing';
import { HierarchyLevel } from '@prisma/client';
import { scopeFilterMiddleware } from './scope-filter.middleware';
import { RequestContextService } from '../../context/request-context.service';
import { UserContext } from '../../../common/types/user-context.type';

describe('ScopeFilterMiddleware', () => {
  let contextService: RequestContextService;
  let middleware: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestContextService],
    }).compile();

    contextService = module.get<RequestContextService>(RequestContextService);
    middleware = scopeFilterMiddleware(contextService);
  });

  describe('Owner bypass', () => {
    it('should not apply scope filter for OWNER users', async () => {
      const userContext: UserContext = {
        userId: 'owner-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.OWNER,
        branchId: null,
        departmentId: null,
        permissionFingerprint: 'fingerprint',
        email: 'owner@example.com',
      };

      const params = {
        model: 'users',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } },
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalledWith(params);
      // Verify no scope filter was added
      expect(params.args.where).toEqual({ email: 'test@example.com' });
    });
  });

  describe('Manager scope filtering', () => {
    it('should apply scope filter for MANAGER users', async () => {
      const userContext: UserContext = {
        userId: 'manager-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
        branchId: 'branch-123',
        departmentId: 'dept-123',
        permissionFingerprint: 'fingerprint',
        email: 'manager@example.com',
      };

      const params = {
        model: 'users',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } },
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalled();
      // Verify scope filter was added
      expect(params.args.where).toEqual({
        AND: [
          { email: 'test@example.com' },
          { branchId: 'branch-123', departmentId: 'dept-123' },
        ],
      });
    });

    it('should apply scope filter with only branchId if departmentId is null', async () => {
      const userContext: UserContext = {
        userId: 'manager-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
        branchId: 'branch-123',
        departmentId: null,
        permissionFingerprint: 'fingerprint',
        email: 'manager@example.com',
      };

      const params = {
        model: 'users',
        action: 'findMany',
        args: { where: {} },
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalled();
      expect(params.args.where).toEqual({
        AND: [{}, { branchId: 'branch-123' }],
      });
    });
  });

  describe('Worker scope filtering', () => {
    it('should apply scope filter for WORKER users', async () => {
      const userContext: UserContext = {
        userId: 'worker-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.WORKER,
        branchId: 'branch-123',
        departmentId: 'dept-123',
        permissionFingerprint: 'fingerprint',
        email: 'worker@example.com',
      };

      const params = {
        model: 'users',
        action: 'findMany',
        args: {},
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalled();
      expect(params.args.where).toEqual({
        AND: [{}, { branchId: 'branch-123', departmentId: 'dept-123' }],
      });
    });
  });

  describe('No user context', () => {
    it('should not apply scope filter when no user context exists', async () => {
      const params = {
        model: 'users',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } },
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run({ correlationId: 'test' }, async () => {
        await middleware(params, next);
      });

      expect(next).toHaveBeenCalledWith(params);
      expect(params.args.where).toEqual({ email: 'test@example.com' });
    });
  });

  describe('Non-read operations', () => {
    it('should not apply scope filter for write operations', async () => {
      const userContext: UserContext = {
        userId: 'manager-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
        branchId: 'branch-123',
        departmentId: 'dept-123',
        permissionFingerprint: 'fingerprint',
        email: 'manager@example.com',
      };

      const params = {
        model: 'users',
        action: 'create',
        args: { data: { email: 'new@example.com' } },
      };

      const next = jest.fn().mockResolvedValue({});

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalledWith(params);
      // Verify no scope filter was added to create operation
      expect(params.args).toEqual({ data: { email: 'new@example.com' } });
    });
  });

  describe('Non-scoped models', () => {
    it('should not apply scope filter for models without scope fields', async () => {
      const userContext: UserContext = {
        userId: 'manager-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
        branchId: 'branch-123',
        departmentId: 'dept-123',
        permissionFingerprint: 'fingerprint',
        email: 'manager@example.com',
      };

      const params = {
        model: 'organizations',
        action: 'findMany',
        args: { where: {} },
      };

      const next = jest.fn().mockResolvedValue([]);

      await contextService.run(
        { correlationId: 'test', user: userContext },
        async () => {
          await middleware(params, next);
        },
      );

      expect(next).toHaveBeenCalledWith(params);
      // Verify no scope filter was added for non-scoped model
      expect(params.args.where).toEqual({});
    });
  });
});
