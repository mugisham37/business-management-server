import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { UserService } from '../../../modules/user/user.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  CreateManagerInput,
  CreateWorkerInput,
  UpdateUserManagementInput,
  CreateUserResponse,
  UserManagementType,
  UsersListResponse,
} from '../types/user-management.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * UserResolver
 *
 * Handles GraphQL mutations and queries for user management including:
 * - Manager creation (owner only)
 * - Worker creation (manager only)
 * - User updates
 * - User queries with scope filtering
 *
 * Requirements: 4.1, 4.2, 15.2, 15.3
 */
@Resolver()
export class UserResolver extends BaseResolver {
  constructor(private readonly userService: UserService) {
    super('UserResolver');
  }

  /**
   * Create manager (owner only)
   *
   * Requirement 4.1: Owners can create managers
   * Requirement 15.2: Apply permission guard
   * Requirement 15.3: Apply hierarchy guard
   *
   * @param input - Manager creation data
   * @param currentUser - Current authenticated user
   * @returns Created user with temporary password
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('USERS', 'CREATE')
  @Mutation(() => CreateUserResponse, { name: 'createManager' })
  async createManager(
    @Args('input') input: CreateManagerInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<CreateUserResponse> {
    this.logOperation('createManager', {
      email: input.email,
      creatorId: currentUser.userId,
    });

    const result = await this.userService.createManager(
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        organizationId: input.organizationId,
        branchId: input.branchId,
        departmentId: input.departmentId,
        staffProfile: {
          fullName: input.staffProfile.fullName,
          positionTitle: input.staffProfile.positionTitle,
          employeeCode: input.staffProfile.employeeCode,
          hireDate: input.staffProfile.hireDate,
        },
      },
      currentUser.userId,
    );

    return {
      user: this.mapUserToType(result.user),
      temporaryCredential: result.temporaryPassword,
      credentialType: 'password',
    };
  }

  /**
   * Create worker (manager only)
   *
   * Requirement 4.2: Managers can create workers
   * Requirement 15.2: Apply permission guard
   * Requirement 15.3: Apply hierarchy guard
   *
   * @param input - Worker creation data
   * @param currentUser - Current authenticated user
   * @returns Created user with temporary password or PIN
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.MANAGER)
  @RequirePermission('USERS', 'CREATE')
  @Mutation(() => CreateUserResponse, { name: 'createWorker' })
  async createWorker(
    @Args('input') input: CreateWorkerInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<CreateUserResponse> {
    this.logOperation('createWorker', {
      email: input.email,
      creatorId: currentUser.userId,
    });

    const result = await this.userService.createWorker(
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        organizationId: input.organizationId,
        staffProfile: {
          fullName: input.staffProfile.fullName,
          positionTitle: input.staffProfile.positionTitle,
          employeeCode: input.staffProfile.employeeCode,
          hireDate: input.staffProfile.hireDate,
        },
        usePIN: input.usePIN,
      },
      currentUser.userId,
    );

    return {
      user: this.mapUserToType(result.user),
      temporaryCredential: result.temporaryCredential,
      credentialType: result.credentialType,
    };
  }

  /**
   * Update user details
   *
   * Requirement 4.1: Update user information
   * Requirement 15.2: Apply permission guard
   *
   * @param userId - User ID to update
   * @param input - Update data
   * @param currentUser - Current authenticated user
   * @returns Updated user
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'UPDATE')
  @Mutation(() => UserManagementType, { name: 'updateUser' })
  async updateUser(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserManagementInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<UserManagementType> {
    this.logOperation('updateUser', {
      userId,
      updaterId: currentUser.userId,
    });

    const result = await this.userService.updateUser(userId, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      status: input.status,
      branchId: input.branchId,
      departmentId: input.departmentId,
    });

    return this.mapUserToType(result);
  }

  /**
   * Get user by ID
   *
   * Requirement 4.1: Query user information
   * Requirement 15.2: Apply permission guard
   * Requirement 9.1, 9.2: Scope filtering applied by middleware
   *
   * @param userId - User ID to retrieve
   * @param currentUser - Current authenticated user
   * @returns User details
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => UserManagementType, { name: 'getUser', nullable: true })
  async getUser(
    @Args('userId') userId: string,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<UserManagementType | null> {
    this.logOperation('getUser', {
      userId,
      requesterId: currentUser.userId,
    });

    const user = await this.userService.findById(userId);

    if (!user) {
      return null;
    }

    return this.mapUserToType(user);
  }

  /**
   * Get users list with scope filtering
   *
   * Requirement 4.1: Query users
   * Requirement 15.2: Apply permission guard
   * Requirement 9.1, 9.2: Scope filtering applied automatically by Prisma middleware
   *
   * Note: Scope filtering is handled by Prisma middleware based on user's
   * hierarchyLevel, branchId, and departmentId from the JWT token.
   * Owners see all users, managers/workers see only users in their scope.
   *
   * @param currentUser - Current authenticated user
   * @returns List of users within scope
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('USERS', 'READ')
  @Query(() => UsersListResponse, { name: 'getUsers' })
  async getUsers(
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<UsersListResponse> {
    this.logOperation('getUsers', {
      requesterId: currentUser.userId,
    });

    // Note: The Prisma middleware will automatically apply scope filtering
    // based on the user's hierarchyLevel, branchId, and departmentId
    // This is implemented in src/core/database/prisma.middleware.ts
    
    // For now, we'll implement a basic query
    // The scope filtering middleware will handle the WHERE clause injection
    const users = await this.userService.findAll(currentUser.organizationId);

    return {
      users: users.map((user: any) => this.mapUserToType(user)),
      total: users.length,
    };
  }

  /**
   * Map database user to GraphQL type
   *
   * @param user - User from database
   * @returns Mapped user type
   */
  private mapUserToType(user: any): UserManagementType {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hierarchyLevel: user.hierarchyLevel,
      status: user.status,
      organizationId: user.organizationId,
      branchId: user.branchId,
      departmentId: user.departmentId,
      createdById: user.createdById,
      staffProfile: user.staff_profiles
        ? {
            id: user.staff_profiles.id,
            userId: user.staff_profiles.userId,
            fullName: user.staff_profiles.fullName,
            positionTitle: user.staff_profiles.positionTitle,
            employeeCode: user.staff_profiles.employeeCode,
            hireDate: user.staff_profiles.hireDate,
            reportsToUserId: user.staff_profiles.reportsToUserId,
            createdAt: user.staff_profiles.createdAt,
            updatedAt: user.staff_profiles.updatedAt,
          }
        : undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
