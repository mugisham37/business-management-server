import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { BaseGrpcController } from './base-grpc.controller';
import { PermissionEngineService } from '../../../modules/authorization/permission-engine.service';
import { TokenService } from '../../../modules/auth/token.service';
import { PermissionService } from '../../../modules/permission/permission.service';
import { UserService } from '../../../modules/user/user.service';
import type {
  CheckPermissionRequest,
  CheckPermissionResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  GetUserPermissionsRequest,
  GetUserPermissionsResponse,
  UserIdentity,
  ModulePermission,
} from '../interfaces/authorization.interface';
import { HierarchyLevel as GrpcHierarchyLevel } from '../interfaces/authorization.interface';
import { HierarchyLevel } from '@prisma/client';

@Controller()
export class AuthorizationGrpcController extends BaseGrpcController {
  constructor(
    private readonly permissionEngine: PermissionEngineService,
    private readonly tokenService: TokenService,
    private readonly permissionService: PermissionService,
    private readonly userService: UserService,
  ) {
    super('AuthorizationGrpcController');
  }

  /**
   * Check if user has permission for a specific action
   * Requirement 16.1, 16.2: Execute all four authorization layers
   */
  @GrpcMethod('AuthorizationService', 'CheckPermission')
  async checkPermission(
    data: CheckPermissionRequest,
  ): Promise<CheckPermissionResponse> {
    const traceId = data.trace_metadata?.['trace_id'] || this.generateTraceId();
    this.logRequest('CheckPermission', {
      ...data,
      trace_id: traceId,
    });

    try {
      this.validateRequired(data, ['user_id', 'module', 'action']);

      // Fetch user to get full context
      const user = await this.userService.findById(data.user_id);
      if (!user) {
        throw new Error('User not found');
      }

      // Build authorization context
      const context = {
        userId: data.user_id,
        organizationId: user.organizationId,
        hierarchyLevel: user.hierarchyLevel,
        branchId: user.branchId,
        departmentId: user.departmentId,
        module: data.module,
        action: data.action,
        resourceId: data.resource_id,
        resourceScope: data.resource_scope
          ? {
              branchId: data.resource_scope.branch_id,
              departmentId: data.resource_scope.department_id,
            }
          : undefined,
        transactionContext: data.transaction_context
          ? {
              transactionType: data.transaction_context.transaction_type,
              amount: data.transaction_context.amount,
            }
          : undefined,
      };

      // Execute authorization check through all four layers
      const result = await this.permissionEngine.checkAuthorization(context);

      const response: CheckPermissionResponse = {
        authorized: result.authorized,
        failed_layer: result.failedLayer,
        reason: result.reason,
        requires_approval: result.requiresApproval || false,
        approver_level: result.approverLevel
          ? this.mapHierarchyLevelToGrpc(result.approverLevel)
          : undefined,
        trace_metadata: {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        },
      };

      this.logResponse('CheckPermission', traceId);
      return response;
    } catch (error) {
      this.handleGrpcError(error, traceId);
    }
  }

  /**
   * Validate access token and return user identity
   * Requirement 16.3: Validate token and return decoded user identity
   */
  @GrpcMethod('AuthorizationService', 'ValidateToken')
  async validateToken(
    data: ValidateTokenRequest,
  ): Promise<ValidateTokenResponse> {
    const traceId = data.trace_metadata?.['trace_id'] || this.generateTraceId();
    this.logRequest('ValidateToken', {
      access_token: '***',
      trace_id: traceId,
    });

    try {
      this.validateRequired(data, ['access_token']);

      // Validate the access token
      const payload = await this.tokenService.validateAccessToken(
        data.access_token,
      );

      // Extract user context
      const userContext = this.tokenService.extractUserContext(payload);

      const userIdentity: UserIdentity = {
        user_id: userContext.userId,
        organization_id: userContext.organizationId,
        hierarchy_level: this.mapHierarchyLevelToGrpc(
          userContext.hierarchyLevel,
        ),
        branch_id: userContext.branchId || undefined,
        department_id: userContext.departmentId || undefined,
        permission_fingerprint: userContext.permissionFingerprint,
        email: userContext.email,
        issued_at: payload.iat || 0,
        expires_at: payload.exp || 0,
      };

      const response: ValidateTokenResponse = {
        valid: true,
        user_identity: userIdentity,
        trace_metadata: {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        },
      };

      this.logResponse('ValidateToken', traceId);
      return response;
    } catch (error) {
      // Return validation failure instead of throwing
      const errorCode = this.getTokenErrorCode(error as Error);
      const response: ValidateTokenResponse = {
        valid: false,
        error_code: errorCode,
        error_message: (error as Error).message,
        trace_metadata: {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        },
      };

      this.logResponse('ValidateToken', traceId);
      return response;
    }
  }

  /**
   * Get all active permissions for a user
   * Requirement 16.4: Return all active permissions
   */
  @GrpcMethod('AuthorizationService', 'GetUserPermissions')
  async getUserPermissions(
    data: GetUserPermissionsRequest,
  ): Promise<GetUserPermissionsResponse> {
    const traceId = data.trace_metadata?.['trace_id'] || this.generateTraceId();
    this.logRequest('GetUserPermissions', {
      user_id: data.user_id,
      trace_id: traceId,
    });

    try {
      this.validateRequired(data, ['user_id']);

      // Get user permissions from permission service
      const permissionSet = await this.permissionService.getUserPermissions(
        data.user_id,
      );

      // Convert to gRPC format
      const permissions: ModulePermission[] = Object.entries(
        permissionSet.modules,
      ).map(([module, actions]) => ({
        module,
        actions: Array.isArray(actions) ? actions : [],
      }));

      const response: GetUserPermissionsResponse = {
        permissions,
        permission_fingerprint: permissionSet.fingerprint,
        trace_metadata: {
          trace_id: traceId,
          timestamp: new Date().toISOString(),
        },
      };

      this.logResponse('GetUserPermissions', traceId);
      return response;
    } catch (error) {
      this.handleGrpcError(error, traceId);
    }
  }

  /**
   * Map Prisma HierarchyLevel to gRPC HierarchyLevel
   */
  private mapHierarchyLevelToGrpc(level: HierarchyLevel): GrpcHierarchyLevel {
    switch (level) {
      case HierarchyLevel.OWNER:
        return GrpcHierarchyLevel.OWNER;
      case HierarchyLevel.MANAGER:
        return GrpcHierarchyLevel.MANAGER;
      case HierarchyLevel.WORKER:
        return GrpcHierarchyLevel.WORKER;
      default:
        return GrpcHierarchyLevel.HIERARCHY_LEVEL_UNSPECIFIED;
    }
  }

  /**
   * Get error code from token validation error
   */
  private getTokenErrorCode(error: Error): string {
    if (error.message?.includes('expired')) {
      return 'EXPIRED';
    }
    if (error.message?.includes('blacklisted')) {
      return 'BLACKLISTED';
    }
    if (error.message?.includes('fingerprint')) {
      return 'FINGERPRINT_MISMATCH';
    }
    if (error.message?.includes('signature')) {
      return 'INVALID_SIGNATURE';
    }
    return 'INVALID_TOKEN';
  }

  /**
   * Generate a unique trace ID for request tracing
   * Requirement 16.7: Include request tracing metadata
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Handle gRPC errors with proper status codes
   * Requirement 16.6: Implement error handling with gRPC status codes
   */
  private handleGrpcError(error: unknown, traceId: string): never {
    const err = error as Error;
    this.logger.error(`gRPC Error [${traceId}]:`, err);

    let grpcStatus = GrpcStatus.INTERNAL;
    let message = 'Internal server error';

    if (err.message?.includes('not found')) {
      grpcStatus = GrpcStatus.NOT_FOUND;
      message = err.message;
    } else if (err.message?.includes('permission') || err.message?.includes('unauthorized')) {
      grpcStatus = GrpcStatus.PERMISSION_DENIED;
      message = err.message;
    } else if (err.message?.includes('unauthenticated') || err.message?.includes('token')) {
      grpcStatus = GrpcStatus.UNAUTHENTICATED;
      message = err.message;
    } else if (err.message?.includes('invalid') || err.message?.includes('validation')) {
      grpcStatus = GrpcStatus.INVALID_ARGUMENT;
      message = err.message;
    }

    throw new RpcException({
      code: grpcStatus,
      message,
      details: {
        trace_id: traceId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
