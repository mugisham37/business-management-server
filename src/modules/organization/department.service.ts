import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { departments as Department } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * DepartmentService
 * 
 * Manages department creation and manager assignment.
 * Enforces code uniqueness within organization.
 */
@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create department with code uniqueness validation
   * 
   * @param dto - Department creation data
   * @returns Created department
   */
  async createDepartment(dto: CreateDepartmentDto): Promise<Department> {
    // Check if code already exists in organization
    const existing = await this.prisma.departments.findUnique({
      where: {
        organizationId_code: {
          organizationId: dto.organizationId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Department code '${dto.code}' already exists in this organization`,
      );
    }

    // If branchId is provided, verify it exists
    if (dto.branchId) {
      const branch = await this.prisma.branches.findUnique({
        where: { id: dto.branchId },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }

      if (branch.organizationId !== dto.organizationId) {
        throw new BadRequestException('Branch does not belong to this organization');
      }
    }

    // Create department
    const department = await this.prisma.departments.create({
      data: {
        id: uuidv4(),
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        name: dto.name,
        code: dto.code,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return department;
  }

  /**
   * Update department
   * 
   * @param deptId - Department ID
   * @param dto - Update data
   * @returns Updated department
   */
  async updateDepartment(deptId: string, dto: UpdateDepartmentDto): Promise<Department> {
    // Check if department exists
    const existing = await this.prisma.departments.findUnique({
      where: { id: deptId },
    });

    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    // If code is being updated, check uniqueness
    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.departments.findUnique({
        where: {
          organizationId_code: {
            organizationId: existing.organizationId,
            code: dto.code,
          },
        },
      });

      if (codeExists) {
        throw new BadRequestException(
          `Department code '${dto.code}' already exists in this organization`,
        );
      }
    }

    // If branchId is being updated, verify it exists
    if (dto.branchId !== undefined) {
      if (dto.branchId) {
        const branch = await this.prisma.branches.findUnique({
          where: { id: dto.branchId },
        });

        if (!branch) {
          throw new NotFoundException('Branch not found');
        }

        if (branch.organizationId !== existing.organizationId) {
          throw new BadRequestException('Branch does not belong to this organization');
        }
      }
    }

    // Update department
    const updated = await this.prisma.departments.update({
      where: { id: deptId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Assign manager to department
   * Updates department's managerId and manager's departmentId
   * Enforces single assignment rule
   * 
   * @param deptId - Department ID
   * @param managerId - Manager user ID
   */
  async assignManager(deptId: string, managerId: string): Promise<void> {
    // Check if department exists
    const department = await this.prisma.departments.findUnique({
      where: { id: deptId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Check if user exists and is a manager
    const user = await this.prisma.users.findUnique({
      where: { id: managerId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hierarchyLevel !== 'MANAGER') {
      throw new BadRequestException('User must be a manager');
    }

    // Check if manager is already assigned to another department
    if (user.departmentId && user.departmentId !== deptId) {
      throw new BadRequestException(
        'Manager is already assigned to another department',
      );
    }

    // Update department and user in a transaction
    await this.prisma.$transaction([
      this.prisma.departments.update({
        where: { id: deptId },
        data: {
          managerId,
          updatedAt: new Date(),
        },
      }),
      this.prisma.users.update({
        where: { id: managerId },
        data: {
          departmentId: deptId,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * Get departments for organization
   * 
   * @param organizationId - Organization ID
   * @returns Array of departments
   */
  async getDepartments(organizationId: string): Promise<Department[]> {
    return this.prisma.departments.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get departments for branch
   * 
   * @param branchId - Branch ID
   * @returns Array of departments
   */
  async getDepartmentsByBranch(branchId: string): Promise<Department[]> {
    return this.prisma.departments.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get department by ID
   * 
   * @param deptId - Department ID
   * @returns Department or null
   */
  async findById(deptId: string): Promise<Department | null> {
    return this.prisma.departments.findUnique({
      where: { id: deptId },
    });
  }
}
