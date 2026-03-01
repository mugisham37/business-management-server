import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { OrganizationService } from '../../../modules/organization/organization.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { PermissionGuard } from '../../../modules/authorization/guards/permission.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../../modules/authorization/decorators/require-permission.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  OrganizationType,
  UpdateOrganizationInput,
} from '../types/organization.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * OrganizationResolver
 *
 * Handles GraphQL mutations and queries for organization management including:
 * - Organization updates
 * - Organization queries
 *
 * Requirements: 15.2, 15.3
 */
@Resolver()
export class OrganizationResolver extends BaseResolver {
  constructor(private readonly organizationService: OrganizationService) {
    super('OrganizationResolver');
  }

  /**
   * Update organization settings
   *
   * Requirement 15.2: Apply permission guard
   * Requirement 15.3: Apply hierarchy guard (owner only)
   *
   * @param input - Organization update data
   * @param currentUser - Current authenticated user
   * @returns Updated organization
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @RequirePermission('SETTINGS', 'UPDATE')
  @Mutation(() => OrganizationType, { name: 'updateOrganization' })
  async updateOrganization(
    @Args('input') input: UpdateOrganizationInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<OrganizationType> {
    this.logOperation('updateOrganization', {
      organizationId: currentUser.organizationId,
      updaterId: currentUser.userId,
    });

    const result = await this.organizationService.updateOrganization(
      currentUser.organizationId,
      {
        name: input.name,
        type: input.type as any,
        status: input.status as any,
      },
    );

    return this.mapOrganizationToType(result);
  }

  /**
   * Get organization details
   *
   * Requirement 15.2: Apply permission guard
   *
   * @param currentUser - Current authenticated user
   * @returns Organization details
   */
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission('SETTINGS', 'READ')
  @Query(() => OrganizationType, { name: 'getOrganization', nullable: true })
  async getOrganization(
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<OrganizationType | null> {
    this.logOperation('getOrganization', {
      organizationId: currentUser.organizationId,
      requesterId: currentUser.userId,
    });

    const organization = await this.organizationService.findById(
      currentUser.organizationId,
    );

    if (!organization) {
      return null;
    }

    return this.mapOrganizationToType(organization);
  }

  /**
   * Map database organization to GraphQL type
   *
   * @param org - Organization from database
   * @returns Mapped organization type
   */
  private mapOrganizationToType(org: any): OrganizationType {
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      status: org.status,
      ownerId: org.ownerId,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}
