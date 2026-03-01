import { Injectable } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionCacheService } from '../permission/permission-cache.service';
import {
  AuthorizationContext,
  AuthorizationResult,
  BusinessRuleResult,
  TransactionContext,
} from '../../common/types/authorization.type';
import { ResourceScope } from '../../common/types/permission.type';

/**
 * Permission Engine Service
 * Executes four-layer authorization checks
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
@Injectable()
export class PermissionEngineService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionCacheService: PermissionCacheService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PermissionEngineService');
  }

  /**
   * Execute all four authorization layers
   * Requirement 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
   * 
   * Layers:
   * 1. Hierarchy Level Check
   * 2. Module Permission Check
   * 3. Scope Check
   * 4. Business Rules Check
   * 
   * @param context - Authorization context
   * @returns Authorization result with success/failure details
   */
  async checkAuthorization(context: AuthorizationContext): Promise<AuthorizationResult> {
    this.logger.logWithMetadata('debug', 'Starting authorization check', {
      userId: context.userId,
      module: context.module,
      action: context.action,
      hierarchyLevel: context.hierarchyLevel,
    });

    try {
      // Fetch user for hierarchy and scope checks
      const user = await this.prismaService.users.findUnique({
        where: { id: context.userId },
        select: {
          id: true,
          hierarchyLevel: true,
          branchId: true,
          departmentId: true,
          organizationId: true,
        },
      });

      if (!user) {
        return {
          authorized: false,
          failedLayer: 'USER_NOT_FOUND',
          reason: 'User not found',
        };
      }

      // Layer 1: Hierarchy Level Check (Requirement 7.1)
      const hierarchyPassed = await this.checkHierarchyLevel(
        user,
        context.hierarchyLevel,
      );

      if (!hierarchyPassed) {
        this.logger.logWithMetadata('warn', 'Authorization failed at Layer 1', {
          userId: context.userId,
          userLevel: user.hierarchyLevel,
          requiredLevel: context.hierarchyLevel,
        });

        return {
          authorized: false,
          failedLayer: 'HIERARCHY_LEVEL',
          reason: `Insufficient hierarchy level. Required: ${context.hierarchyLevel}, User has: ${user.hierarchyLevel}`,
        };
      }

      // Layer 2: Module Permission Check (Requirement 7.2)
      const permissionPassed = await this.checkModulePermission(
        context.userId,
        context.module,
        context.action,
      );

      if (!permissionPassed) {
        this.logger.logWithMetadata('warn', 'Authorization failed at Layer 2', {
          userId: context.userId,
          module: context.module,
          action: context.action,
        });

        return {
          authorized: false,
          failedLayer: 'MODULE_PERMISSION',
          reason: `Missing permission for module: ${context.module}, action: ${context.action}`,
        };
      }

      // Layer 3: Scope Check (Requirement 7.3, 7.7)
      // Skip for OWNER (Requirement 7.7)
      if (user.hierarchyLevel !== HierarchyLevel.OWNER && context.resourceScope) {
        const scopePassed = await this.checkScope(user, context.resourceScope);

        if (!scopePassed) {
          this.logger.logWithMetadata('warn', 'Authorization failed at Layer 3', {
            userId: context.userId,
            userBranchId: user.branchId,
            userDepartmentId: user.departmentId,
            resourceScope: context.resourceScope,
          });

          return {
            authorized: false,
            failedLayer: 'SCOPE',
            reason: 'Resource is outside user scope (branch/department)',
          };
        }
      }

      // Layer 4: Business Rules Check (Requirement 7.4)
      if (context.transactionContext) {
        const businessRuleResult = await this.checkBusinessRules({
          userId: context.userId,
          organizationId: context.organizationId,
          hierarchyLevel: user.hierarchyLevel,
          transactionContext: context.transactionContext,
        });

        if (!businessRuleResult.passed) {
          this.logger.logWithMetadata('warn', 'Authorization failed at Layer 4', {
            userId: context.userId,
            transactionType: context.transactionContext.transactionType,
            amount: context.transactionContext.amount,
            requiresApproval: businessRuleResult.requiresApproval,
          });

          return {
            authorized: false,
            failedLayer: 'BUSINESS_RULES',
            reason: 'Transaction requires approval',
            requiresApproval: businessRuleResult.requiresApproval,
            approverLevel: businessRuleResult.approverLevel,
          };
        }
      }

      // All layers passed
      this.logger.logWithMetadata('debug', 'Authorization successful', {
        userId: context.userId,
        module: context.module,
        action: context.action,
      });

      return {
        authorized: true,
      };
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error during authorization check', {
        userId: context.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        authorized: false,
        failedLayer: 'SYSTEM_ERROR',
        reason: 'Internal error during authorization check',
      };
    }
  }

  /**
   * Layer 1: Check hierarchy level
   * Requirement 7.1
   * 
   * @param user - User object with hierarchy level
   * @param requiredLevel - Minimum required hierarchy level
   * @returns True if user meets or exceeds required level
   */
  async checkHierarchyLevel(
    user: { hierarchyLevel: HierarchyLevel },
    requiredLevel: HierarchyLevel,
  ): Promise<boolean> {
    // Define hierarchy order: OWNER > MANAGER > WORKER
    const hierarchyOrder = {
      [HierarchyLevel.OWNER]: 3,
      [HierarchyLevel.MANAGER]: 2,
      [HierarchyLevel.WORKER]: 1,
    };

    const userLevel = hierarchyOrder[user.hierarchyLevel];
    const required = hierarchyOrder[requiredLevel];

    return userLevel >= required;
  }

  /**
   * Layer 2: Check module permission
   * Requirement 7.2
   * 
   * @param userId - User ID
   * @param module - Module name
   * @param action - Action name
   * @returns True if user has permission for module and action
   */
  async checkModulePermission(
    userId: string,
    module: string,
    action: string,
  ): Promise<boolean> {
    try {
      // Get permissions from cache (or database)
      const permissions = await this.permissionCacheService.getPermissions(userId);

      // Check if user has the module
      if (!permissions.modules[module]) {
        return false;
      }

      // Check if user has the action for the module
      return permissions.modules[module].includes(action);
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error checking module permission', {
        userId,
        module,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Layer 3: Check scope boundaries
   * Requirement 7.3
   * 
   * @param user - User object with scope information
   * @param resourceScope - Resource scope to check against
   * @returns True if resource is within user's scope
   */
  async checkScope(
    user: {
      hierarchyLevel: HierarchyLevel;
      branchId: string | null;
      departmentId: string | null;
    },
    resourceScope: ResourceScope,
  ): Promise<boolean> {
    // OWNER has organization-wide scope (handled by caller)
    if (user.hierarchyLevel === HierarchyLevel.OWNER) {
      return true;
    }

    // Check branch scope
    if (resourceScope.branchId && user.branchId !== resourceScope.branchId) {
      return false;
    }

    // Check department scope
    if (resourceScope.departmentId && user.departmentId !== resourceScope.departmentId) {
      return false;
    }

    return true;
  }

  /**
   * Layer 4: Check business rules
   * Requirement 7.4, 7.5
   * 
   * @param context - Business rule context
   * @returns Business rule result with approval requirements
   */
  async checkBusinessRules(context: {
    userId: string;
    organizationId: string;
    hierarchyLevel: HierarchyLevel;
    transactionContext: TransactionContext;
  }): Promise<BusinessRuleResult> {
    try {
      // OWNER bypasses all business rules
      if (context.hierarchyLevel === HierarchyLevel.OWNER) {
        return {
          passed: true,
          requiresApproval: false,
        };
      }

      // Get active rules for this transaction type, ordered by priority
      const rules = await this.prismaService.authorization_rules.findMany({
        where: {
          organizationId: context.organizationId,
          transactionType: context.transactionContext.transactionType,
          isActive: true,
          appliesToLevel: context.hierarchyLevel,
        },
        orderBy: {
          priority: 'desc', // Higher priority first
        },
      });

      // If no rules match, allow the transaction
      if (rules.length === 0) {
        return {
          passed: true,
          requiresApproval: false,
        };
      }

      // Evaluate rules in priority order
      for (const rule of rules) {
        // Check if transaction amount exceeds threshold
        if (context.transactionContext.amount > rule.thresholdValue) {
          this.logger.logWithMetadata('debug', 'Business rule triggered', {
            ruleId: rule.id,
            ruleName: rule.ruleName,
            threshold: rule.thresholdValue,
            amount: context.transactionContext.amount,
            approverLevel: rule.approverLevel,
          });

          return {
            passed: false,
            requiresApproval: true,
            approverLevel: rule.approverLevel,
            matchedRuleId: rule.id,
          };
        }
      }

      // No rules triggered, allow transaction
      return {
        passed: true,
        requiresApproval: false,
      };
    } catch (error) {
      this.logger.logWithMetadata('error', 'Error checking business rules', {
        userId: context.userId,
        transactionType: context.transactionContext.transactionType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fail safe: deny on error
      return {
        passed: false,
        requiresApproval: true,
      };
    }
  }
}
