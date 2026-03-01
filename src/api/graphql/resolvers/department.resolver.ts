import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { DepartmentService } from '../../../modules/organization/department.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  DepartmentType,
  DepartmentsListResponse,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from '../types/organization.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * DepartmentResolver
 *
 * Handles GraphQL mutations and queries for department management including:
 * - Department creation
 * - Department updates
 * - Manager assignment
 * - Department queries
 *
 * Requirements: 11.2, 11.4, 15.2
 */
@Resolver()
export class DepartmentResolver extends BaseResolver {
  constructor(private readonly departmentService: DepartmentService) {
    super('DepartmentResolver');
  }

  /**
   * Create department
   *
   * Requirement 11.2: Create department with code uniqueness validation
   * Requirement 15.2: Apply permission guard
   *
   * @param input - Department creation data
   * @param currentUser - Current authenticated user
   * @returns Created department
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => DepartmentType, { name: 'createDepartment' })
  async createDepartment(
    @Args('input') input: CreateDepartmentInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<DepartmentType> {
    this.logOperation('createDepartment', {
      organizationId: input.organizationId,
      code: input.code,
      creatorId: currentUser.userId,
    });

    const result = await this.departmentService.createDepartment({
      organizationId: input.organizationId,
      branchId: input.branchId,
      name: input.name,
      code: input.code,
    });

    return this.mapDepartmentToType(result);
  }

  /**
   * Update department
   *
   * Requirement 11.2: Update department with code uniqueness validation
   * Requirement 15.2: Apply permission guard
   *
   * @param departmentId - Department ID to update
   * @param input - Department update data
   * @param currentUser - Current authenticated user
   * @returns Updated department
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => DepartmentType, { name: 'updateDepartment' })
  async updateDepartment(
    @Args('departmentId') departmentId: string,
    @Args('input') input: UpdateDepartmentInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<DepartmentType> {
    this.logOperation('updateDepartment', {
      departmentId,
      updaterId: currentUser.userId,
    });

    const result = await this.departmentService.updateDepartment(departmentId, {
      name: input.name,
      code: input.code,
      branchId: input.branchId,
    });

    return this.mapDepartmentToType(result);
  }

  /**
   * Assign manager to department
   *
   * Requirement 11.4: Assign manager to department
   * Requirement 15.2: Apply permission guard
   *
   * @param departmentId - Department ID
   * @param managerId - Manager user ID
   * @param currentUser - Current authenticated user
   * @returns Success boolean
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => Boolean, { name: 'assignDepartmentManager' })
  async assignDepartmentManager(
    @Args('departmentId') departmentId: string,
    @Args('managerId') managerId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<boolean> {
    this.logOperation('assignDepartmentManager', {
      departmentId,
      managerId,
      assignerId: currentUser.userId,
    });

    await this.departmentService.assignManager(departmentId, managerId);

    return true;
  }

  /**
   * Get departments for organization
   *
   * Requirement 11.2: Query departments
   * Requirement 15.2: Apply permission guard
   *
   * @param currentUser - Current authenticated user
   * @returns List of departments
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('SETTINGS', 'READ')
  @Query(() => DepartmentsListResponse, { name: 'getDepartments' })
  async getDepartments(
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<DepartmentsListResponse> {
    this.logOperation('getDepartments', {
      organizationId: currentUser.organizationId,
      requesterId: currentUser.userId,
    });

    const departments = await this.departmentService.getDepartments(
      currentUser.organizationId,
    );

    return {
      departments: departments.map((dept: any) => this.mapDepartmentToType(dept)),
      total: departments.length,
    };
  }

  /**
   * Map database department to GraphQL type
   *
   * @param department - Department from database
   * @returns Mapped department type
   */
  private mapDepartmentToType(department: any): DepartmentType {
    return {
      id: department.id,
      organizationId: department.organizationId,
      branchId: department.branchId,
      name: department.name,
      code: department.code,
      managerId: department.managerId,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
