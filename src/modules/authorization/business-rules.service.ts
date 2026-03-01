import { Injectable, BadRequestException } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { BusinessRuleResult, TransactionContext } from '../../common/types/authorization.type';

/**
 * Business Rules Service
 * Evaluates transaction-based authorization rules
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
@Injectable()
export class BusinessRulesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('BusinessRulesService');
  }

  /**
   * Evaluate rules for transaction
   * Requirement 10.1, 10.2, 10.3, 10.5
   * 
   * @param context - Transaction context
   * @param user - User object with hierarchy level
   * @returns Business rule result with approval requirements
   */
  async evaluateRules(
    context: TransactionContext,
    user: { id: string; organizationId: string; hierarchyLevel: HierarchyLevel },
  ): Promise<BusinessRuleResult> {
    try {
      this.logger.logWithMetadata('debug', 'Evaluating business rules', {
        userId: user.id,
        transactionType: context.transactionType,
        amount: context.amount,
        hierarchyLevel: user.hierarchyLevel,
      });

      // Requirement 10.6: OWNER bypasses all business rules
      if (user.hierarchyLevel === HierarchyLevel.OWNER) {
        this.logger.logWithMetadata('debug', 'Owner bypasses business rules', {
          userId: user.id,
        });

        return {
          passed: true,
          requiresApproval: false,
        };
      }

      // Requirement 10.1: Get active rules for transaction type
      const rules = await this.getActiveRules(
        user.organizationId,
        context.transactionType,
      );

      // If no rules match, allow the transaction
      if (rules.length === 0) {
        this.logger.logWithMetadata('debug', 'No matching rules found', {
          transactionType: context.transactionType,
        });

        return {
          passed: true,
          requiresApproval: false,
        };
      }

      // Requirement 10.2: Evaluate rules in priority order (highest first)
      for (const rule of rules) {
        // Check if rule applies to user's hierarchy level
        if (rule.appliesToLevel !== user.hierarchyLevel) {
          continue;
        }

        // Requirement 10.3: Check if threshold is exceeded
        if (context.amount > rule.thresholdValue) {
          this.logger.logWithMetadata('info', 'Business rule triggered', {
            ruleId: rule.id,
            ruleName: rule.ruleName,
            threshold: rule.thresholdValue,
            amount: context.amount,
            approverLevel: rule.approverLevel,
          });

          // Requirement 10.5: Require approval from specified level
          return {
            passed: false,
            requiresApproval: true,
            approverLevel: rule.approverLevel,
            matchedRuleId: rule.id,
          };
        }
      }

      // No rules triggered, allow transaction
      this.logger.logWithMetadata('debug', 'All rules passed', {
        userId: user.id,
        transactionType: context.transactionType,
      });

      return {
        passed: true,
        requiresApproval: false,
      };
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error evaluating business rules', {
        userId: user.id,
        transactionType: context.transactionType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fail safe: deny on error
      return {
        passed: false,
        requiresApproval: true,
      };
    }
  }

  /**
   * Get active rules for transaction type
   * Requirement 10.1, 10.2
   * 
   * @param organizationId - Organization ID
   * @param transactionType - Transaction type
   * @returns Array of active rules ordered by priority (highest first)
   */
  async getActiveRules(
    organizationId: string,
    transactionType: string,
  ): Promise<Array<{
    id: string;
    ruleName: string;
    transactionType: string;
    basedOn: string;
    thresholdValue: number;
    appliesToLevel: HierarchyLevel;
    approverLevel: HierarchyLevel;
    priority: number;
  }>> {
    try {
      const rules = await this.prismaService.authorization_rules.findMany({
        where: {
          organizationId,
          transactionType,
          isActive: true,
        },
        orderBy: {
          priority: 'desc', // Requirement 10.2: Higher priority first
        },
        select: {
          id: true,
          ruleName: true,
          transactionType: true,
          basedOn: true,
          thresholdValue: true,
          appliesToLevel: true,
          approverLevel: true,
          priority: true,
        },
      });

      this.logger.logWithMetadata('debug', 'Retrieved active rules', {
        organizationId,
        transactionType,
        ruleCount: rules.length,
      });

      return rules;
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error retrieving active rules', {
        organizationId,
        transactionType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all rules for organization
   * Requirement 10.1
   * 
   * @param organizationId - Organization ID
   * @returns Array of all rules ordered by priority (highest first)
   */
  async getAllRules(
    organizationId: string,
  ): Promise<Array<{
    id: string;
    organizationId: string;
    ruleName: string;
    transactionType: string;
    basedOn: string;
    thresholdValue: number;
    appliesToLevel: HierarchyLevel;
    approverLevel: HierarchyLevel;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    try {
      const rules = await this.prismaService.authorization_rules.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          priority: 'desc',
        },
      });

      this.logger.logWithMetadata('debug', 'Retrieved all rules', {
        organizationId,
        ruleCount: rules.length,
      });

      return rules;
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error retrieving all rules', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create authorization rule
   * Requirement 10.1
   * 
   * @param dto - Rule creation data
   * @returns Created rule
   */
  async createRule(dto: {
    organizationId: string;
    ruleName: string;
    transactionType: string;
    basedOn: string;
    thresholdValue: number;
    appliesToLevel: HierarchyLevel;
    approverLevel: HierarchyLevel;
    priority: number;
  }): Promise<{
    id: string;
    organizationId: string;
    ruleName: string;
    transactionType: string;
    basedOn: string;
    thresholdValue: number;
    appliesToLevel: HierarchyLevel;
    approverLevel: HierarchyLevel;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      // Validate threshold value is positive
      if (dto.thresholdValue <= 0) {
        throw new BadRequestException('Threshold value must be positive');
      }

      // Validate priority is non-negative
      if (dto.priority < 0) {
        throw new BadRequestException('Priority must be non-negative');
      }

      const rule = await this.prismaService.authorization_rules.create({
        data: {
          id: this.generateId(),
          organizationId: dto.organizationId,
          ruleName: dto.ruleName,
          transactionType: dto.transactionType,
          basedOn: dto.basedOn,
          thresholdValue: dto.thresholdValue,
          appliesToLevel: dto.appliesToLevel,
          approverLevel: dto.approverLevel,
          priority: dto.priority,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      this.logger.logWithMetadata('info', 'Authorization rule created', {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        organizationId: rule.organizationId,
      });

      return rule;
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error creating authorization rule', {
        ruleName: dto.ruleName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update authorization rule
   * Requirement 10.1
   * 
   * @param ruleId - Rule ID
   * @param dto - Rule update data
   * @returns Updated rule
   */
  async updateRule(
    ruleId: string,
    dto: Partial<{
      ruleName: string;
      transactionType: string;
      basedOn: string;
      thresholdValue: number;
      appliesToLevel: HierarchyLevel;
      approverLevel: HierarchyLevel;
      priority: number;
      isActive: boolean;
    }>,
  ): Promise<{
    id: string;
    organizationId: string;
    ruleName: string;
    transactionType: string;
    basedOn: string;
    thresholdValue: number;
    appliesToLevel: HierarchyLevel;
    approverLevel: HierarchyLevel;
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    try {
      // Validate threshold value if provided
      if (dto.thresholdValue !== undefined && dto.thresholdValue <= 0) {
        throw new BadRequestException('Threshold value must be positive');
      }

      // Validate priority if provided
      if (dto.priority !== undefined && dto.priority < 0) {
        throw new BadRequestException('Priority must be non-negative');
      }

      const rule = await this.prismaService.authorization_rules.update({
        where: { id: ruleId },
        data: {
          ...dto,
          updatedAt: new Date(),
        },
      });

      this.logger.logWithMetadata('info', 'Authorization rule updated', {
        ruleId: rule.id,
        ruleName: rule.ruleName,
      });

      return rule;
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error updating authorization rule', {
        ruleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate approver for transaction
   * Requirement 10.4: Prevent self-approval
   * 
   * @param transactionCreatorId - ID of user who created the transaction
   * @param approverId - ID of user attempting to approve
   * @param requiredLevel - Required hierarchy level for approval
   * @returns True if approver is valid
   */
  async validateApprover(
    transactionCreatorId: string,
    approverId: string,
    requiredLevel: HierarchyLevel,
  ): Promise<boolean> {
    try {
      // Requirement 10.4: Prevent self-approval
      if (transactionCreatorId === approverId) {
        this.logger.logWithMetadata('warn', 'Self-approval attempt detected', {
          userId: approverId,
        });
        return false;
      }

      // Verify approver has required hierarchy level
      const approver = await this.prismaService.users.findUnique({
        where: { id: approverId },
        select: {
          hierarchyLevel: true,
        },
      });

      if (!approver) {
        this.logger.logWithMetadata('warn', 'Approver not found', {
          approverId,
        });
        return false;
      }

      // Define hierarchy order: OWNER > MANAGER > WORKER
      const hierarchyOrder = {
        [HierarchyLevel.OWNER]: 3,
        [HierarchyLevel.MANAGER]: 2,
        [HierarchyLevel.WORKER]: 1,
      };

      const approverLevel = hierarchyOrder[approver.hierarchyLevel];
      const required = hierarchyOrder[requiredLevel];

      const isValid = approverLevel >= required;

      this.logger.logWithMetadata('debug', 'Approver validation result', {
        approverId,
        approverLevel: approver.hierarchyLevel,
        requiredLevel,
        isValid,
      });

      return isValid;
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error validating approver', {
        transactionCreatorId,
        approverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generate unique ID for rules
   * @private
   */
  private generateId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
