import {
  Catch,
  ArgumentsHost,
  HttpException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { AuthorizationException } from '../../../common/exceptions/authorization.exception';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * GraphQL Exception Filter
 * 
 * Implements comprehensive error handling with:
 * - Error code mapping
 * - Message sanitization
 * - Contextual logging
 * - Layer-specific error details
 * 
 * Requirements: 15.6, 17.8, 19.2, 19.4, 19.5, 19.8
 */
@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  private readonly logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
    this.logger.setContext('GraphQLExceptionFilter');
  }

  catch(exception: any, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const info = gqlHost.getInfo();
    const context = gqlHost.getContext();

    // Extract user context for logging (if available)
    const userId = context.req?.user?.userId;
    const organizationId = context.req?.user?.organizationId;

    // Log error with full context (Requirement 19.2, 19.4)
    this.logError(exception, info, userId, organizationId);

    // Map error to GraphQL error code
    const errorCode = this.getErrorCode(exception);
    
    // Sanitize error message (Requirement 17.8)
    const message = this.sanitizeErrorMessage(exception, errorCode);

    // Build error extensions with additional context
    const extensions = this.buildErrorExtensions(exception, errorCode, info);

    return new GraphQLError(message, {
      extensions,
    });
  }

  /**
   * Log error with full context
   * Requirement 19.2, 19.4, 19.5
   */
  private logError(
    exception: any,
    info: any,
    userId?: string,
    organizationId?: string,
  ): void {
    const errorContext = {
      fieldName: info.fieldName,
      operation: info.operation?.operation,
      userId,
      organizationId,
      errorType: exception.constructor.name,
      statusCode: exception.status || exception.statusCode,
    };

    // Log with appropriate level based on error type
    if (this.isCriticalError(exception)) {
      this.logger.error(
        `Critical GraphQL Error: ${exception.message}`,
        exception.stack,
        'GraphQLExceptionFilter',
      );
      this.logger.logWithMetadata(
        'error',
        'Critical GraphQL Error Context',
        errorContext,
        'GraphQLExceptionFilter',
      );
    } else if (this.isClientError(exception)) {
      this.logger.warn(
        `Client Error in ${info.fieldName}: ${exception.message}`,
        'GraphQLExceptionFilter',
      );
      this.logger.logWithMetadata(
        'warn',
        'Client Error Context',
        errorContext,
        'GraphQLExceptionFilter',
      );
    } else {
      this.logger.error(
        `GraphQL Error in ${info.fieldName}: ${exception.message}`,
        exception.stack,
        'GraphQLExceptionFilter',
      );
      this.logger.logWithMetadata(
        'error',
        'GraphQL Error Context',
        errorContext,
        'GraphQLExceptionFilter',
      );
    }
  }

  /**
   * Map exception to GraphQL error code
   * Requirement 15.6
   */
  private getErrorCode(exception: any): string {
    // Check for specific exception types first
    if (exception instanceof UnauthorizedException) {
      return 'UNAUTHENTICATED';
    }
    if (exception instanceof AuthorizationException) {
      return 'FORBIDDEN';
    }
    if (exception instanceof ValidationException || exception instanceof BadRequestException) {
      return 'BAD_USER_INPUT';
    }
    if (exception instanceof NotFoundException) {
      return 'NOT_FOUND';
    }
    if (exception instanceof ConflictException) {
      return 'CONFLICT';
    }

    // Check for custom error codes in exception
    if (exception.code) {
      return exception.code;
    }

    // Fall back to status code mapping
    const statusCode = exception.status || exception.statusCode;

    switch (statusCode) {
      case 400:
        return 'BAD_USER_INPUT';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }

  /**
   * Sanitize error message to prevent information leakage
   * Requirement 17.8
   */
  private sanitizeErrorMessage(exception: any, errorCode: string): string {
    // For internal server errors, return generic message
    if (errorCode === 'INTERNAL_SERVER_ERROR') {
      return 'An internal error occurred. Please try again later.';
    }

    // For client errors, return the original message (already safe)
    if (this.isClientError(exception)) {
      return exception.message || 'Bad request';
    }

    // For HTTP exceptions, use the message
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && 'message' in response) {
        const msg = (response as any).message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
    }

    // Default to exception message, but sanitize sensitive patterns
    const message = exception.message || 'An error occurred';
    return this.removeSensitiveInfo(message);
  }

  /**
   * Remove sensitive information from error messages
   * Requirement 17.8
   */
  private removeSensitiveInfo(message: string): string {
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
   * Build error extensions with additional context
   * Requirement 15.6, 19.5
   */
  private buildErrorExtensions(
    exception: any,
    errorCode: string,
    info: any,
  ): Record<string, any> {
    const extensions: Record<string, any> = {
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    // Add field information for validation errors
    if (exception.field) {
      extensions.field = exception.field;
    }

    // Add layer information for authorization errors
    if (exception.layer) {
      extensions.layer = exception.layer;
    }

    // Add reason for additional context
    if (exception.reason) {
      extensions.reason = exception.reason;
    }

    // Add validation errors if present
    if (exception.validationErrors) {
      extensions.validationErrors = exception.validationErrors;
    }

    // Add path information
    if (info.path) {
      extensions.path = info.path;
    }

    return extensions;
  }

  /**
   * Check if error is a critical system error
   */
  private isCriticalError(exception: any): boolean {
    const statusCode = exception.status || exception.statusCode;
    return !statusCode || statusCode >= 500;
  }

  /**
   * Check if error is a client error (4xx)
   */
  private isClientError(exception: any): boolean {
    const statusCode = exception.status || exception.statusCode;
    return statusCode >= 400 && statusCode < 500;
  }
}
