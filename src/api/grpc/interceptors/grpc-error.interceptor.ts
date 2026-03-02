import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';
import { GrpcError } from '../interfaces';
import { AuthorizationException } from '../../../common/exceptions/authorization.exception';
import { ValidationException } from '../../../common/exceptions/validation.exception';

/**
 * gRPC Error Formatting Interceptor
 * 
 * Catches and formats errors for gRPC protocol with:
 * - Error code mapping to gRPC status codes
 * - Message sanitization
 * - Contextual logging
 * - Correlation ID tracking
 * 
 * Requirements: 16.6, 16.7, 17.8, 19.2, 19.4
 */
@Injectable()
export class GrpcErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GrpcErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();

    // Only apply to gRPC requests
    if (type !== 'rpc') {
      return next.handle();
    }

    // Get method name for logging
    const methodName = context.getHandler().name;

    return next.handle().pipe(
      catchError((error) => {
        // Get correlation ID from metadata if available
        const metadata = context.getArgByIndex(1);
        const correlationId = metadata?.get('x-correlation-id')?.[0];

        // Log error with context (Requirement 19.2, 19.4)
        this.logError(error, methodName, correlationId);

        // If already an RpcException, pass it through
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        // Map common errors to gRPC status codes
        const grpcError: GrpcError = this.mapErrorToGrpcError(
          error,
          correlationId,
        );

        return throwError(() => new RpcException(grpcError));
      }),
    );
  }

  /**
   * Log error with full context
   * Requirement 19.2, 19.4
   */
  private logError(
    error: any,
    methodName: string,
    correlationId?: string,
  ): void {
    const errorContext = {
      method: methodName,
      correlationId,
      errorType: error.constructor.name,
      statusCode: error.status || error.statusCode,
    };

    // Log with appropriate level based on error type
    if (this.isCriticalError(error)) {
      this.logger.error(
        `Critical gRPC Error in ${methodName}: ${error.message}`,
        error.stack,
        JSON.stringify(errorContext),
      );
    } else if (this.isClientError(error)) {
      this.logger.warn(
        `Client Error in ${methodName}: ${error.message}`,
        JSON.stringify(errorContext),
      );
    } else {
      this.logger.error(
        `gRPC Error in ${methodName}: ${error.message}`,
        error.stack,
        JSON.stringify(errorContext),
      );
    }
  }

  /**
   * Map error to gRPC error format with sanitization
   * Requirement 16.6, 17.8
   */
  private mapErrorToGrpcError(error: any, correlationId?: string): GrpcError {
    const timestamp = new Date().toISOString();

    // Map specific exception types
    if (error instanceof UnauthorizedException) {
      return {
        code: 'UNAUTHENTICATED',
        message: this.sanitizeMessage(error.message || 'Authentication required'),
        timestamp,
        correlationId,
      };
    }

    if (error instanceof AuthorizationException) {
      return {
        code: 'PERMISSION_DENIED',
        message: this.sanitizeMessage(error.message || 'Permission denied'),
        timestamp,
        correlationId,
        details: error.layer ? { layer: error.layer, reason: error.reason } : undefined,
      };
    }

    if (error instanceof NotFoundException) {
      return {
        code: 'NOT_FOUND',
        message: this.sanitizeMessage(error.message || 'Resource not found'),
        timestamp,
        correlationId,
      };
    }

    if (error instanceof ValidationException) {
      return {
        code: 'INVALID_ARGUMENT',
        message: this.sanitizeMessage(error.message || 'Invalid request'),
        timestamp,
        correlationId,
        details: error.field ? { field: error.field } : undefined,
      };
    }

    if (error instanceof BadRequestException) {
      return {
        code: 'INVALID_ARGUMENT',
        message: this.sanitizeMessage(error.message || 'Invalid request'),
        timestamp,
        correlationId,
      };
    }

    if (error instanceof ConflictException) {
      return {
        code: 'ALREADY_EXISTS',
        message: this.sanitizeMessage(error.message || 'Resource already exists'),
        timestamp,
        correlationId,
      };
    }

    // For internal errors, return generic message (Requirement 17.8)
    if (this.isCriticalError(error)) {
      return {
        code: 'INTERNAL',
        message: 'An internal error occurred. Please try again later.',
        timestamp,
        correlationId,
      };
    }

    // Default error
    return {
      code: 'UNKNOWN',
      message: this.sanitizeMessage(error.message || 'An error occurred'),
      timestamp,
      correlationId,
    };
  }

  /**
   * Sanitize error message to prevent information leakage
   * Requirement 17.8
   */
  private sanitizeMessage(message: string): string {
    // Remove database connection strings
    message = message.replace(/postgresql:\/\/[^\s]+/gi, '[DATABASE_URL]');
    
    // Remove Redis connection strings
    message = message.replace(/redis:\/\/[^\s]+/gi, '[REDIS_URL]');
    
    // Remove file paths
    message = message.replace(/\/[^\s]+\.(ts|js|json)/gi, '[FILE_PATH]');
    
    // Remove JWT tokens
    message = message.replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[TOKEN]');
    
    return message;
  }

  /**
   * Check if error is a critical system error
   */
  private isCriticalError(error: any): boolean {
    const statusCode = error.status || error.statusCode;
    return !statusCode || statusCode >= 500;
  }

  /**
   * Check if error is a client error (4xx)
   */
  private isClientError(error: any): boolean {
    const statusCode = error.status || error.statusCode;
    return statusCode >= 400 && statusCode < 500;
  }
}
