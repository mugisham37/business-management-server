import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from './branch.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BranchService', () => {
  let service: BranchService;
  let prisma: PrismaService;

  const mockPrismaService = {
    branches: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBranch', () => {
    it('should create a branch successfully', async () => {
      const dto = {
        organizationId: 'org-123',
        name: 'Main Branch',
        code: 'MAIN',
        address: '123 Main St',
      };
      const mockBranch = {
        id: 'branch-123',
        ...dto,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.branches.findUnique.mockResolvedValue(null);
      mockPrismaService.branches.create.mockResolvedValue(mockBranch);

      const result = await service.createBranch(dto);

      expect(result).toEqual(mockBranch);
      expect(mockPrismaService.branches.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_code: {
            organizationId: dto.organizationId,
            code: dto.code,
          },
        },
      });
    });

    it('should throw BadRequestException if code already exists', async () => {
      const dto = {
        organizationId: 'org-123',
        name: 'Main Branch',
        code: 'MAIN',
      };

      mockPrismaService.branches.findUnique.mockResolvedValue({
        id: 'existing-branch',
        code: dto.code,
      });

      await expect(service.createBranch(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assignManager', () => {
    it('should assign manager to branch successfully', async () => {
      const branchId = 'branch-123';
      const managerId = 'manager-123';
      const mockBranch = {
        id: branchId,
        organizationId: 'org-123',
        name: 'Main Branch',
        code: 'MAIN',
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'MANAGER',
        branchId: null,
        organizationId: 'org-123',
      };

      mockPrismaService.branches.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      await service.assignManager(branchId, managerId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      const branchId = 'non-existent';
      const managerId = 'manager-123';

      mockPrismaService.branches.findUnique.mockResolvedValue(null);

      await expect(service.assignManager(branchId, managerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is not a manager', async () => {
      const branchId = 'branch-123';
      const managerId = 'worker-123';
      const mockBranch = { id: branchId };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'WORKER',
      };

      mockPrismaService.branches.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);

      await expect(service.assignManager(branchId, managerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if manager already assigned to another branch', async () => {
      const branchId = 'branch-123';
      const managerId = 'manager-123';
      const mockBranch = { id: branchId };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'MANAGER',
        branchId: 'other-branch',
      };

      mockPrismaService.branches.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);

      await expect(service.assignManager(branchId, managerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getBranches', () => {
    it('should return branches for organization', async () => {
      const organizationId = 'org-123';
      const mockBranches = [
        { id: 'branch-1', name: 'Branch 1', organizationId },
        { id: 'branch-2', name: 'Branch 2', organizationId },
      ];

      mockPrismaService.branches.findMany.mockResolvedValue(mockBranches);

      const result = await service.getBranches(organizationId);

      expect(result).toEqual(mockBranches);
      expect(mockPrismaService.branches.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { name: 'asc' },
      });
    });
  });
});
