import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AuditService } from './audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { AuditLogDto } from '../../common/types/audit.type';
import { HierarchyLevel } from '@prisma/client';

describe('AuditService', () => {
  let service: AuditService;
  let mockQueue: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    mockPrisma = {
      audit_logs: {
        findMany: jest.fn(),
      },
    };

    const mockLogger = {
      setContext: jest.fn(),
      logWithMetadata: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getQueueToken('audit'),
          useValue: mockQueue,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should queue audit log with correct priority', async () => {
      const auditLog: AuditLogDto = {
        userId: 'user-123',
        organizationId: 'org-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
        action: 'LOGIN',
        resourceType: 'USER',
        resourceId: 'user-123',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      await service.logAction(auditLog);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'log-action',
        auditLog,
        { priority: 1 }, // LOGIN is high priority
      );
    });

    it('should assign lower priority to non-critical actions', async () => {
      const auditLog: AuditLogDto = {
        action: 'READ',
        resourceType: 'REPORT',
        result: 'SUCCESS',
      };

      await service.logAction(auditLog);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'log-action',
        auditLog,
        { priority: 5 }, // READ is low priority
      );
    });

    it('should not throw error if queue fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      const auditLog: AuditLogDto = {
        action: 'TEST',
        resourceType: 'TEST',
        result: 'SUCCESS',
      };

      await expect(service.logAction(auditLog)).resolves.not.toThrow();
    });
  });

  describe('getUserAuditLogs', () => {
    it('should retrieve audit logs for user', async () => {
      const userId = 'user-123';
      const mockLogs = [
        {
          id: 'log-1',
          userId,
          action: 'LOGIN',
          resourceType: 'USER',
          result: 'SUCCESS',
          createdAt: new Date(),
        },
      ];

      mockPrisma.audit_logs.findMany.mockResolvedValue(mockLogs);

      const result = await service.getUserAuditLogs(userId);

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.audit_logs.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should apply filters correctly', async () => {
      const userId = 'user-123';
      const filters = {
        action: 'LOGIN',
        resourceType: 'USER',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 50,
        offset: 10,
      };

      mockPrisma.audit_logs.findMany.mockResolvedValue([]);

      await service.getUserAuditLogs(userId, filters);

      expect(mockPrisma.audit_logs.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          action: 'LOGIN',
          resourceType: 'USER',
          createdAt: {
            gte: filters.startDate,
            lte: filters.endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 10,
      });
    });
  });

  describe('getOrganizationAuditLogs', () => {
    it('should retrieve audit logs for organization', async () => {
      const organizationId = 'org-123';
      const mockLogs = [
        {
          id: 'log-1',
          organizationId,
          action: 'USER_CREATE',
          resourceType: 'USER',
          result: 'SUCCESS',
          createdAt: new Date(),
        },
      ];

      mockPrisma.audit_logs.findMany.mockResolvedValue(mockLogs);

      const result = await service.getOrganizationAuditLogs(organizationId);

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.audit_logs.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
    });
  });

  describe('getResourceAuditLogs', () => {
    it('should retrieve audit logs for specific resource', async () => {
      const resourceType = 'USER';
      const resourceId = 'user-123';
      const mockLogs = [
        {
          id: 'log-1',
          resourceType,
          resourceId,
          action: 'UPDATE',
          result: 'SUCCESS',
          createdAt: new Date(),
        },
      ];

      mockPrisma.audit_logs.findMany.mockResolvedValue(mockLogs);

      const result = await service.getResourceAuditLogs(resourceType, resourceId);

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.audit_logs.findMany).toHaveBeenCalledWith({
        where: {
          resourceType,
          resourceId,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
