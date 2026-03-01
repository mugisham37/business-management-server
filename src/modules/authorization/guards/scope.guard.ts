import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';
import { UserContext } from '../../../common/types/user-context.type';
import { ResourceScope } from '../../../common/types/permission.type';
import { PermissionEngineService } from '../permission-engine.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * Scope Guard
 * Enforces branch/department scope filtering using the Permission Engine (Layer 3)
 * Automatically extracts resource scope from resolver arguments
 * 
 * Requirements: 15.4
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly permissionEngine: PermissionEngineService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ScopeGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract user context from GraphQL request
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    if (!user) {
      this.logger.logWithMetadata('warn', 'Scope check failed: No user in context', {});
      throw new ForbiddenException('User not authenticated');
    }

    // OWNER bypasses scope checks (Requirement 7.7)
    if (user.hierarchyLevel === HierarchyLevel.OWNER) {
      this.logger.logWithMetadata('debug', 'Scope check bypassed for OWNER', {
        userId: user.userId,
      });
      return true;
    }

    // Extract resource scope from resolver arguments
    const args = ctx.getArgs();
    const resourceScope = this.extractResourceScope(args);

    // If no resource scope in arguments, allow (scope filtering handled by middleware)
    if (!resourceScope.branchId && !resourceScope.departmentId) {
      return true;
    }

    // Check scope using Permission Engine
    const withinScope = await this.permissionEngine.checkScope(
      {
        hierarchyLevel: user.hierarchyLevel,
        branchId: user.branchId,
        departmentId: user.departmentId,
      },
      resourceScope,
    );

    if (!withinScope) {
      this.logger.logWithMetadata('warn', 'Scope check failed', {
        userId: user.userId,
        userBranchId: user.branchId,
        userDepartmentId: user.departmentId,
        resourceScope,
      });

      throw new ForbiddenException(
        'Resource is outside user scope (branch/department)',
      );
    }

    this.logger.logWithMetadata('debug', 'Scope check passed', {
      userId: user.userId,
      resourceScope,
    });

    return true;
  }

  /**
   * Extract resource scope from resolver arguments
   * Looks for branchId and departmentId in arguments
   */
  private extractResourceScope(args: any): ResourceScope {
    const scope: ResourceScope = {};

    // Check for branchId in various argument structures
    if (args.branchId) {
      scope.branchId = args.branchId;
    } else if (args.input?.branchId) {
      scope.branchId = args.input.branchId;
    } else if (args.data?.branchId) {
      scope.branchId = args.data.branchId;
    }

    // Check for departmentId in various argument structures
    if (args.departmentId) {
      scope.departmentId = args.departmentId;
    } else if (args.input?.departmentId) {
      scope.departmentId = args.input.departmentId;
    } else if (args.data?.departmentId) {
      scope.departmentId = args.data.departmentId;
    }

    return scope;
  }
}
