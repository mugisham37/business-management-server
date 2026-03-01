import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuditService } from './audit.service';
import { RequestContextService } from '../../core/context/request-context.service';
import { AuditLogDto } from '../../common/types/audit.type';
import { LoggerService } from '../../core/logging/logger.service';

/**
 * Audit Interceptor
 * 
 * Captures GraphQL requests/responses and logs actions asynchronously.
 * Extracts user context from JWT and request metadata.
 * 
 * Requirements: 12.1, 12.2, 12.3
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger: LoggerService;

  constructor(
    private readonly auditService: AuditService,
    private readonly requestContextService: RequestContextService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('AuditInterceptor');
  }

  /**
   * Intercept GraphQL requests and log actions
   * 
   * Requirement 12.1: Capture userId, organizationId, action, resourceType, resourceId, result
   * Requirement 12.2: Capture oldValue and newValue for mutations
   * Requirement 12.3: Capture ipAddress and userAgent from request
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const request = gqlContext.getContext().req;
    
    // Extract user context from request context service
    const userContext = this.requestContextService.getUserContext();
    const ipAddress = this.requestContextService.getIpAddress();
    const userAgent = this.requestContextService.getUserAgent();

    // Determine if this is a mutation or query
    const operationType = info?.operation?.operation || 'query';
    const fieldName = info?.fieldName;
    const parentType = info?.parentType?.name;

    // Only audit mutations and specific queries
    const shouldAudit = this.shouldAuditOperation(operationType, fieldName);

    if (!shouldAudit) {
      return next.handle();
    }

    const startTime = Date.now();
    const args = gqlContext.getArgs();

    return next.handle().pipe(
      tap((result) => {
        // Log successful operation
        const duration = Date.now() - startTime;
        
        const auditLog: AuditLogDto = {
          userId: userContext?.userId,
          organizationId: userContext?.organizationId,
          hierarchyLevel: userContext?.hierarchyLevel,
          action: this.mapOperationToAction(operationType, fieldName),
          resourceType: this.extractResourceType(fieldName, parentType),
          resourceId: this.extractResourceId(args, result),
          result: 'SUCCESS',
          metadata: {
            operationType,
            fieldName,
            duration,
            args: this.sanitizeArgs(args),
          },
          oldValue: this.extractOldValue(args),
          newValue: this.extractNewValue(result),
          ipAddress,
          userAgent,
        };

        // Log asynchronously
        this.auditService.logAction(auditLog).catch((error) => {
          const errorStack = error instanceof Error ? error.stack : String(error);
          this.logger.error('Failed to log audit action', errorStack);
        });
      }),
      catchError((error) => {
        // Log failed operation
        const duration = Date.now() - startTime;
        
        const auditLog: AuditLogDto = {
          userId: userContext?.userId,
          organizationId: userContext?.organizationId,
          hierarchyLevel: userContext?.hierarchyLevel,
          action: this.mapOperationToAction(operationType, fieldName),
          resourceType: this.extractResourceType(fieldName, parentType),
          resourceId: this.extractResourceId(args, null),
          result: 'FAILURE',
          metadata: {
            operationType,
            fieldName,
            duration,
            error: error.message,
            args: this.sanitizeArgs(args),
          },
          ipAddress,
          userAgent,
        };

        // Log asynchronously
        this.auditService.logAction(auditLog).catch((logError) => {
          const errorStack = logError instanceof Error ? logError.stack : String(logError);
          this.logger.error('Failed to log audit action', errorStack);
        });

        // Re-throw the original error
        throw error;
      }),
    );
  }

  /**
   * Determine if operation should be audited
   * Audit all mutations and specific sensitive queries
   */
  private shouldAuditOperation(operationType: string, fieldName: string): boolean {
    // Always audit mutations
    if (operationType === 'mutation') {
      return true;
    }

    // Audit specific sensitive queries
    const sensitiveQueries = [
      'getUserPermissions',
      'getPermissionHistory',
      'getUserAuditLogs',
      'getOrganizationAuditLogs',
      'getActiveSessions',
    ];

    return sensitiveQueries.includes(fieldName);
  }

  /**
   * Map GraphQL operation to audit action
   */
  private mapOperationToAction(operationType: string, fieldName: string): string {
    if (operationType === 'query') {
      return 'READ';
    }

    // Map common mutation patterns to actions
    const actionMap: Record<string, string> = {
      create: 'CREATE',
      update: 'UPDATE',
      delete: 'DELETE',
      grant: 'GRANT',
      revoke: 'REVOKE',
      login: 'LOGIN',
      logout: 'LOGOUT',
      register: 'REGISTER',
      assign: 'ASSIGN',
      approve: 'APPROVE',
      change: 'CHANGE',
    };

    const lowerFieldName = fieldName.toLowerCase();
    for (const [key, action] of Object.entries(actionMap)) {
      if (lowerFieldName.includes(key)) {
        return action;
      }
    }

    return 'MUTATION';
  }

  /**
   * Extract resource type from field name
   */
  private extractResourceType(fieldName: string, parentType: string): string {
    // Try to extract from field name
    const resourcePatterns = [
      'user',
      'organization',
      'branch',
      'department',
      'permission',
      'session',
      'role',
      'rule',
    ];

    const lowerFieldName = fieldName.toLowerCase();
    for (const pattern of resourcePatterns) {
      if (lowerFieldName.includes(pattern)) {
        return pattern.toUpperCase();
      }
    }

    return parentType || 'UNKNOWN';
  }

  /**
   * Extract resource ID from arguments or result
   */
  private extractResourceId(args: any, result: any): string | undefined {
    // Try to get ID from args
    if (args?.id) return args.id;
    if (args?.userId) return args.userId;
    if (args?.organizationId) return args.organizationId;
    if (args?.branchId) return args.branchId;
    if (args?.departmentId) return args.departmentId;

    // Try to get ID from result
    if (result?.id) return result.id;
    if (result?.userId) return result.userId;

    return undefined;
  }

  /**
   * Extract old value from update arguments
   */
  private extractOldValue(args: any): Record<string, any> | undefined {
    // For update operations, we don't have old value in interceptor
    // This would need to be fetched before update in the resolver
    return undefined;
  }

  /**
   * Extract new value from result
   */
  private extractNewValue(result: any): Record<string, any> | undefined {
    if (!result || typeof result !== 'object') {
      return undefined;
    }

    // Return sanitized result
    return this.sanitizeData(result);
  }

  /**
   * Sanitize arguments to remove sensitive data
   */
  private sanitizeArgs(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const sanitized = { ...args };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'passwordHash',
      'pin',
      'pinHash',
      'token',
      'refreshToken',
      'accessToken',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize data to remove sensitive fields
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'passwordHash',
      'pinHash',
      'refreshTokenHash',
      'accessTokenFingerprint',
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        delete sanitized[field];
      }
    }

    return sanitized;
  }
}
