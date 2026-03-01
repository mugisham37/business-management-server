import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { REQUIRE_PERMISSION_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';
import { UserContext } from '../../../common/types/user-context.type';
import { PermissionEngineService } from '../permission-engine.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * Permission Guard
 * Enforces module permission checks using the Permission Engine (Layer 2)
 * 
 * Requirements: 15.2
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionEngine: PermissionEngineService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PermissionGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from decorator metadata
    const requiredPermission = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission requirement, allow access
    if (!requiredPermission) {
      return true;
    }

    // Extract user context from GraphQL request
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    if (!user) {
      this.logger.logWithMetadata('warn', 'Permission check failed: No user in context', {
        module: requiredPermission.module,
        action: requiredPermission.action,
      });
      throw new ForbiddenException('User not authenticated');
    }

    // Check module permission using Permission Engine
    const hasPermission = await this.permissionEngine.checkModulePermission(
      user.userId,
      requiredPermission.module,
      requiredPermission.action,
    );

    if (!hasPermission) {
      this.logger.logWithMetadata('warn', 'Permission check failed', {
        userId: user.userId,
        module: requiredPermission.module,
        action: requiredPermission.action,
      });

      throw new ForbiddenException(
        `Missing permission for module: ${requiredPermission.module}, action: ${requiredPermission.action}`,
      );
    }

    this.logger.logWithMetadata('debug', 'Permission check passed', {
      userId: user.userId,
      module: requiredPermission.module,
      action: requiredPermission.action,
    });

    return true;
  }
}
