import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { BranchService } from '../../../modules/organization/branch.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  BranchType,
  BranchesListResponse,
  CreateBranchInput,
  UpdateBranchInput,
} from '../types/organization.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * BranchResolver
 *
 * Handles GraphQL mutations and queries for branch management including:
 * - Branch creation
 * - Branch updates
 * - Manager assignment
 * - Branch queries
 *
 * Requirements: 11.1, 11.3, 15.2
 */
@Resolver()
export class BranchResolver extends BaseResolver {
  constructor(private readonly branchService: BranchService) {
    super('BranchResolver');
  }

  /**
   * Create branch
   *
   * Requirement 11.1: Create branch with code uniqueness validation
   * Requirement 15.2: Apply permission guard
   *
   * @param input - Branch creation data
   * @param currentUser - Current authenticated user
   * @returns Created branch
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => BranchType, { name: 'createBranch' })
  async createBranch(
    @Args('input') input: CreateBranchInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BranchType> {
    this.logOperation('createBranch', {
      organizationId: input.organizationId,
      code: input.code,
      creatorId: currentUser.userId,
    });

    const result = await this.branchService.createBranch({
      organizationId: input.organizationId,
      name: input.name,
      code: input.code,
      address: input.address,
    });

    return this.mapBranchToType(result);
  }

  /**
   * Update branch
   *
   * Requirement 11.1: Update branch with code uniqueness validation
   * Requirement 15.2: Apply permission guard
   *
   * @param branchId - Branch ID to update
   * @param input - Branch update data
   * @param currentUser - Current authenticated user
   * @returns Updated branch
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => BranchType, { name: 'updateBranch' })
  async updateBranch(
    @Args('branchId') branchId: string,
    @Args('input') input: UpdateBranchInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BranchType> {
    this.logOperation('updateBranch', {
      branchId,
      updaterId: currentUser.userId,
    });

    const result = await this.branchService.updateBranch(branchId, {
      name: input.name,
      code: input.code,
      address: input.address,
    });

    return this.mapBranchToType(result);
  }

  /**
   * Assign manager to branch
   *
   * Requirement 11.3: Assign manager to branch
   * Requirement 15.2: Apply permission guard
   *
   * @param branchId - Branch ID
   * @param managerId - Manager user ID
   * @param currentUser - Current authenticated user
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => Boolean, { name: 'assignBranchManager' })
  async assignBranchManager(
    @Args('branchId') branchId: string,
    @Args('managerId') managerId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<boolean> {
    this.logOperation('assignBranchManager', {
      branchId,
      managerId,
      assignerId: currentUser.userId,
    });

    await this.branchService.assignManager(branchId, managerId);

    return true;
  }

  /**
   * Get branches for organization
   *
   * Requirement 11.1: Query branches
   * Requirement 15.2: Apply permission guard
   *
   * @param currentUser - Current authenticated user
   * @returns List of branches
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('SETTINGS', 'READ')
  @Query(() => BranchesListResponse, { name: 'getBranches' })
  async getBranches(
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BranchesListResponse> {
    this.logOperation('getBranches', {
      organizationId: currentUser.organizationId,
      requesterId: currentUser.userId,
    });

    const branches = await this.branchService.getBranches(
      currentUser.organizationId,
    );

    return {
      branches: branches.map((branch: any) => this.mapBranchToType(branch)),
      total: branches.length,
    };
  }

  /**
   * Map database branch to GraphQL type
   *
   * @param branch - Branch from database
   * @returns Mapped branch type
   */
  private mapBranchToType(branch: any): BranchType {
    return {
      id: branch.id,
      organizationId: branch.organizationId,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      managerId: branch.managerId,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }
}
