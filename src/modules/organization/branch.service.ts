import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { branches as Branch } from '@prisma/client';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * BranchService
 * 
 * Manages branch creation and manager assignment.
 * Enforces code uniqueness within organization.
 */
@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create branch with code uniqueness validation
   * 
   * @param dto - Branch creation data
   * @returns Created branch
   */
  async createBranch(dto: CreateBranchDto): Promise<Branch> {
    // Check if code already exists in organization
    const existing = await this.prisma.branches.findUnique({
      where: {
        organizationId_code: {
          organizationId: dto.organizationId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Branch code '${dto.code}' already exists in this organization`,
      );
    }

    // Create branch
    const branch = await this.prisma.branches.create({
      data: {
        id: uuidv4(),
        organizationId: dto.organizationId,
        name: dto.name,
        code: dto.code,
        address: dto.address,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return branch;
  }

  /**
   * Update branch
   * 
   * @param branchId - Branch ID
   * @param dto - Update data
   * @returns Updated branch
   */
  async updateBranch(branchId: string, dto: UpdateBranchDto): Promise<Branch> {
    // Check if branch exists
    const existing = await this.prisma.branches.findUnique({
      where: { id: branchId },
    });

    if (!existing) {
      throw new NotFoundException('Branch not found');
    }

    // If code is being updated, check uniqueness
    if (dto.code && dto.code !== existing.code) {
      const codeExists = await this.prisma.branches.findUnique({
        where: {
          organizationId_code: {
            organizationId: existing.organizationId,
            code: dto.code,
          },
        },
      });

      if (codeExists) {
        throw new BadRequestException(
          `Branch code '${dto.code}' already exists in this organization`,
        );
      }
    }

    // Update branch
    const updated = await this.prisma.branches.update({
      where: { id: branchId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Assign manager to branch
   * Updates branch's managerId and manager's branchId
   * Enforces single assignment rule
   * 
   * @param branchId - Branch ID
   * @param managerId - Manager user ID
   */
  async assignManager(branchId: string, managerId: string): Promise<void> {
    // Check if branch exists
    const branch = await this.prisma.branches.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
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

    // Check if manager is already assigned to another branch
    if (user.branchId && user.branchId !== branchId) {
      const currentBranch = await this.prisma.branches.findUnique({
        where: { id: user.branchId },
        select: { name: true, code: true },
      });

      throw new BadRequestException({
        message: `Manager already assigned to "${currentBranch?.name || 'another'}" branch`,
        context: {
          currentBranch: {
            id: user.branchId,
            name: currentBranch?.name,
            code: currentBranch?.code,
          },
          suggestion: `Unassign from "${currentBranch?.name || 'current branch'}" first`,
          action: 'UNASSIGN_FIRST',
        },
      });
    }

    // Update branch and user in a transaction
    await this.prisma.$transaction([
      this.prisma.branches.update({
        where: { id: branchId },
        data: {
          managerId,
          updatedAt: new Date(),
        },
      }),
      this.prisma.users.update({
        where: { id: managerId },
        data: {
          branchId,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * Get branches for organization
   * 
   * @param organizationId - Organization ID
   * @returns Array of branches
   */
  async getBranches(organizationId: string): Promise<Branch[]> {
    return this.prisma.branches.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get branch by ID
   * 
   * @param branchId - Branch ID
   * @returns Branch or null
   */
  async findById(branchId: string): Promise<Branch | null> {
    return this.prisma.branches.findUnique({
      where: { id: branchId },
    });
  }
}
