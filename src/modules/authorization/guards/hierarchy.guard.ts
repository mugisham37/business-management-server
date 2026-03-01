import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { HierarchyLevel } from '@prisma/client';
import { REQUIRE_LEVEL_KEY } from '../decorators/require-level.decorator';
import { UserContext } from '../../../common/types/user-context.type';
import { PermissionEngineService } from '../permission-engine.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * Hierarchy Guard
 * Enforces minimum hierarchy level checks using the Permission Engine (Layer 1)
 * 
 * Requirements: 15.3
 */
@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionEngine: PermissionEngineService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('HierarchyGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required hierarchy level from decorator metadata
    const requiredLevel = this.reflector.getAllAndOverride<HierarchyLevel>(
      REQUIRE_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no level requirement, allow access
    if (!requiredLevel) {
      return true;
    }

    // Extract user context from GraphQL request
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    if (!user) {
      this.logger.logWithMetadata('warn', 'Hierarchy check failed: No user in context', {
        requiredLevel,
      });
      throw new ForbiddenException('User not authenticated');
    }

    // Check hierarchy level using Permission Engine
    const meetsLevel = await this.permissionEngine.checkHierarchyLevel(
      { hierarchyLevel: user.hierarchyLevel },
      requiredLevel,
    );

    if (!meetsLevel) {
      this.logger.logWithMetadata('warn', 'Hierarchy check failed', {
        userId: user.userId,
        userLevel: user.hierarchyLevel,
        requiredLevel,
      });

      throw new ForbiddenException(
        `Insufficient hierarchy level. Required: ${requiredLevel}, User has: ${user.hierarchyLevel}`,
      );
    }

    this.logger.logWithMetadata('debug', 'Hierarchy check passed', {
      userId: user.userId,
      userLevel: user.hierarchyLevel,
      requiredLevel,
    });

    return true;
  }
}
