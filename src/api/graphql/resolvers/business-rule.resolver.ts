import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { BaseResolver } from './base.resolver';
import { BusinessRulesService } from '../../../modules/authorization/business-rules.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { HierarchyGuard } from '../../../modules/authorization/guards/hierarchy.guard';
import { GqlCurrentUser } from '../decorators/current-user.decorator';
import { RequireLevel } from '../../../modules/authorization/decorators/require-level.decorator';
import {
  BusinessRuleType,
  CreateBusinessRuleInput,
  UpdateBusinessRuleInput,
  BusinessRulesListResponse,
} from '../types/business-rule.type';
import type { UserContext } from '../../../common/types/user-context.type';

/**
 * BusinessRuleResolver
 *
 * Handles GraphQL mutations and queries for business rule management including:
 * - Rule creation (owner only)
 * - Rule updates (owner only)
 * - Rule queries
 *
 * Requirements: 10.1, 15.2, 15.3
 */
@Resolver()
export class BusinessRuleResolver extends BaseResolver {
  constructor(private readonly businessRulesService: BusinessRulesService) {
    super('BusinessRuleResolver');
  }

  /**
   * Create authorization rule
   *
   * Requirement 10.1: Create business rules for transaction approval workflows
   * Requirement 15.2: Apply guards
   * Requirement 15.3: Owner-only access
   *
   * @param input - Rule creation data
   * @param currentUser - Current authenticated user (must be owner)
   * @returns Created rule
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @Mutation(() => BusinessRuleType, { name: 'createBusinessRule' })
  async createRule(
    @Args('input') input: CreateBusinessRuleInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BusinessRuleType> {
    this.logOperation('createBusinessRule', {
      organizationId: currentUser.organizationId,
      creatorId: currentUser.userId,
      ruleName: input.ruleName,
      transactionType: input.transactionType,
    });

    const rule = await this.businessRulesService.createRule({
      organizationId: currentUser.organizationId,
      ruleName: input.ruleName,
      transactionType: input.transactionType,
      basedOn: input.basedOn,
      thresholdValue: input.thresholdValue,
      appliesToLevel: input.appliesToLevel,
      approverLevel: input.approverLevel,
      priority: input.priority,
    });

    return rule;
  }

  /**
   * Update authorization rule
   *
   * Requirement 10.1: Update business rules
   * Requirement 15.2: Apply guards
   * Requirement 15.3: Owner-only access
   *
   * @param ruleId - Rule ID to update
   * @param input - Rule update data
   * @param currentUser - Current authenticated user (must be owner)
   * @returns Updated rule
   */
  @UseGuards(GqlAuthGuard, HierarchyGuard)
  @RequireLevel(HierarchyLevel.OWNER)
  @Mutation(() => BusinessRuleType, { name: 'updateBusinessRule' })
  async updateRule(
    @Args('ruleId') ruleId: string,
    @Args('input') input: UpdateBusinessRuleInput,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BusinessRuleType> {
    this.logOperation('updateBusinessRule', {
      organizationId: currentUser.organizationId,
      updaterId: currentUser.userId,
      ruleId,
    });

    const rule = await this.businessRulesService.updateRule(ruleId, {
      ruleName: input.ruleName,
      transactionType: input.transactionType,
      basedOn: input.basedOn,
      thresholdValue: input.thresholdValue,
      appliesToLevel: input.appliesToLevel,
      approverLevel: input.approverLevel,
      priority: input.priority,
      isActive: input.isActive,
    });

    return rule;
  }

  /**
   * Get active rules for organization
   *
   * Requirement 10.1: Query business rules
   * Requirement 15.2: Apply guards
   *
   * @param transactionType - Optional filter by transaction type
   * @param currentUser - Current authenticated user
   * @returns List of rules
   */
  @UseGuards(GqlAuthGuard)
  @Query(() => BusinessRulesListResponse, { name: 'getBusinessRules' })
  async getRules(
    @Args('transactionType', { nullable: true }) transactionType: string | null,
    @GqlCurrentUser() currentUser: UserContext,
  ): Promise<BusinessRulesListResponse> {
    this.logOperation('getBusinessRules', {
      organizationId: currentUser.organizationId,
      requesterId: currentUser.userId,
      transactionType,
    });

    // If transactionType is provided, get filtered rules
    if (transactionType) {
      const rules = await this.businessRulesService.getActiveRules(
        currentUser.organizationId,
        transactionType,
      );

      // Map to include all required fields
      const mappedRules = rules.map((rule) => ({
        ...rule,
        organizationId: currentUser.organizationId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      return {
        rules: mappedRules,
        total: mappedRules.length,
      };
    }

    // Otherwise, get all rules for the organization
    const allRules = await this.businessRulesService.getAllRules(
      currentUser.organizationId,
    );

    return {
      rules: allRules,
      total: allRules.length,
    };
  }
}
