import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '../../core/database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let prisma: PrismaService;

  const mockPrismaService = {
    departments: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    branches: {
      findUnique: jest.fn(),
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
        DepartmentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDepartment', () => {
    it('should create a department successfully', async () => {
      const dto = {
        organizationId: 'org-123',
        name: 'Sales Department',
        code: 'SALES',
      };
      const mockDepartment = {
        id: 'dept-123',
        ...dto,
        branchId: null,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(null);
      mockPrismaService.departments.create.mockResolvedValue(mockDepartment);

      const result = await service.createDepartment(dto);

      expect(result).toEqual(mockDepartment);
      expect(mockPrismaService.departments.findUnique).toHaveBeenCalledWith({
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
        name: 'Sales Department',
        code: 'SALES',
      };

      mockPrismaService.departments.findUnique.mockResolvedValue({
        id: 'existing-dept',
        code: dto.code,
      });

      await expect(service.createDepartment(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create department with branchId', async () => {
      const dto = {
        organizationId: 'org-123',
        branchId: 'branch-123',
        name: 'Sales Department',
        code: 'SALES',
      };
      const mockBranch = {
        id: dto.branchId,
        organizationId: dto.organizationId,
      };
      const mockDepartment = {
        id: 'dept-123',
        ...dto,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(null);
      mockPrismaService.branches.findUnique.mockResolvedValue(mockBranch);
      mockPrismaService.departments.create.mockResolvedValue(mockDepartment);

      const result = await service.createDepartment(dto);

      expect(result).toEqual(mockDepartment);
      expect(mockPrismaService.branches.findUnique).toHaveBeenCalledWith({
        where: { id: dto.branchId },
      });
    });

    it('should throw NotFoundException if branch does not exist', async () => {
      const dto = {
        organizationId: 'org-123',
        branchId: 'non-existent',
        name: 'Sales Department',
        code: 'SALES',
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(null);
      mockPrismaService.branches.findUnique.mockResolvedValue(null);

      await expect(service.createDepartment(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignManager', () => {
    it('should assign manager to department successfully', async () => {
      const deptId = 'dept-123';
      const managerId = 'manager-123';
      const mockDepartment = {
        id: deptId,
        organizationId: 'org-123',
        name: 'Sales Department',
        code: 'SALES',
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'MANAGER',
        departmentId: null,
        organizationId: 'org-123',
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      await service.assignManager(deptId, managerId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if department does not exist', async () => {
      const deptId = 'non-existent';
      const managerId = 'manager-123';

      mockPrismaService.departments.findUnique.mockResolvedValue(null);

      await expect(service.assignManager(deptId, managerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is not a manager', async () => {
      const deptId = 'dept-123';
      const managerId = 'worker-123';
      const mockDepartment = { id: deptId };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'WORKER',
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);

      await expect(service.assignManager(deptId, managerId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if manager already assigned to another department', async () => {
      const deptId = 'dept-123';
      const managerId = 'manager-123';
      const mockDepartment = { id: deptId };
      const mockUser = {
        id: managerId,
        hierarchyLevel: 'MANAGER',
        departmentId: 'other-dept',
      };

      mockPrismaService.departments.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.users.findUnique.mockResolvedValue(mockUser);

      await expect(service.assignManager(deptId, managerId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDepartments', () => {
    it('should return departments for organization', async () => {
      const organizationId = 'org-123';
      const mockDepartments = [
        { id: 'dept-1', name: 'Department 1', organizationId },
        { id: 'dept-2', name: 'Department 2', organizationId },
      ];

      mockPrismaService.departments.findMany.mockResolvedValue(mockDepartments);

      const result = await service.getDepartments(organizationId);

      expect(result).toEqual(mockDepartments);
      expect(mockPrismaService.departments.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getDepartmentsByBranch', () => {
    it('should return departments for branch', async () => {
      const branchId = 'branch-123';
      const mockDepartments = [
        { id: 'dept-1', name: 'Department 1', branchId },
        { id: 'dept-2', name: 'Department 2', branchId },
      ];

      mockPrismaService.departments.findMany.mockResolvedValue(mockDepartments);

      const result = await service.getDepartmentsByBranch(branchId);

      expect(result).toEqual(mockDepartments);
      expect(mockPrismaService.departments.findMany).toHaveBeenCalledWith({
        where: { branchId },
        orderBy: { name: 'asc' },
      });
    });
  });
});
