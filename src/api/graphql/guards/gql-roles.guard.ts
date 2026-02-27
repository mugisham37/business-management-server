import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../../../core/auth/decorators/roles.decorator';
import { UserContext } from '../../../core/auth/interfaces';

/**
 * GraphQL Roles Guard
 * Enforces role-based authorization on GraphQL resolvers
 */
@Injectable()
export class GqlRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    if (!user) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
