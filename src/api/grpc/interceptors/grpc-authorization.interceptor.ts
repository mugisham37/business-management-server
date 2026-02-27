import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { RpcException } from '@nestjs/microservices';

/**
 * gRPC Authorization Interceptor
 * Checks user roles and permissions from metadata
 */
@Injectable()
export class GrpcAuthorizationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const type = context.getType();

    // Only apply to gRPC requests
    if (type !== 'rpc') {
      return next.handle();
    }

    // Get required roles from decorator
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no roles or permissions required, allow access
    if (!requiredRoles && !requiredPermissions) {
      return next.handle();
    }

    const metadata = context.getArgByIndex(1);
    const userJson = metadata?.get('user')?.[0];

    if (!userJson) {
      throw new RpcException({
        code: 'PERMISSION_DENIED',
        message: 'User context not found',
        timestamp: new Date().toISOString(),
      });
    }

    const user = JSON.parse(userJson);

    // Check roles
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) =>
        user.roles?.includes(role),
      );

      if (!hasRole) {
        throw new RpcException({
          code: 'PERMISSION_DENIED',
          message: `Required roles: ${requiredRoles.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      );

      if (!hasPermission) {
        throw new RpcException({
          code: 'PERMISSION_DENIED',
          message: `Required permissions: ${requiredPermissions.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return next.handle();
  }
}
