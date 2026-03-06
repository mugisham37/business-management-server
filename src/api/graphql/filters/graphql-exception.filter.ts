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
    const userId = context?.req?.user?.userId;
    const organizationId = context?.req?.user?.organizationId;
    const correlationId = context?.req?.correlationId || context?.correlationId || 'unknown';

    // Log error with full context (Requirement 19.2, 19.4)
    this.logError(exception, info, userId, organizationId, correlationId);

    // Map error to GraphQL error code
    const errorCode = this.getErrorCode(exception);
    
    // Sanitize error message (Requirement 17.8)
    const message = this.sanitizeErrorMessage(exception, errorCode);

    // Build error extensions with additional context
    const extensions = this.buildErrorExtensions(exception, errorCode, info, correlationId);

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
    correlationId?: string,
  ): void {
    const errorContext = {
      fieldName: info.fieldName,
      operation: info.operation?.operation,
      userId,
      organizationId,
      correlationId,
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
      const message = exception.message || 'Bad request';
      return this.enhanceUserFriendlyMessage(message, errorCode);
    }

    // For HTTP exceptions, use the message
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return this.enhanceUserFriendlyMessage(response, errorCode);
      }
      if (typeof response === 'object' && 'message' in response) {
        const msg = (response as any).message;
        const message = Array.isArray(msg) ? msg.join(', ') : String(msg);
        return this.enhanceUserFriendlyMessage(message, errorCode);
      }
    }

    // Default to exception message, but sanitize sensitive patterns
    const message = exception.message || 'An error occurred';
    const sanitized = this.removeSensitiveInfo(message);
    return this.enhanceUserFriendlyMessage(sanitized, errorCode);
  }

  /**
   * Enhance error messages to be more user-friendly
   */
  private enhanceUserFriendlyMessage(message: string, errorCode: string): string {
    // Prisma unique constraint errors
    if (message.includes('Unique constraint failed')) {
      const fieldMatch = message.match(/\(`(\w+)`\)/);
      if (fieldMatch) {
        const field = fieldMatch[1];
        const friendlyField = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        
        // Provide context-specific messages
        if (field === 'name') {
          return 'This organization name is already registered. Please choose a different name.';
        }
        if (field === 'email') {
          return 'An account with this email already exists. Try logging in instead.';
        }
        if (field === 'username') {
          return 'This username is already taken. Please choose a different username.';
        }
        
        return `A record with this ${friendlyField.toLowerCase()} already exists.`;
      }
      return 'This value already exists in the system.';
    }

    // Prisma foreign key constraint errors
    if (message.includes('Foreign key constraint failed')) {
      return 'The referenced item does not exist or has been deleted.';
    }

    // Prisma record not found errors
    if (message.includes('Record to update not found')) {
      return 'The item you are trying to update no longer exists.';
    }

    if (message.includes('Record to delete does not exist')) {
      return 'This item has already been deleted.';
    }

    // Authentication errors
    if (message.includes('Invalid credentials')) {
      return 'The email or password you entered is incorrect.';
    }

    if (message.includes('User with this email already exists')) {
      return 'An account with this email address already exists.';
    }

    if (message.includes('Account is locked')) {
      return 'Your account has been temporarily locked due to multiple failed login attempts.';
    }

    if (message.includes('Token expired')) {
      return 'Your session has expired. Please log in again.';
    }

    // Password validation errors
    if (message.includes('Password must be at least')) {
      return 'Your password does not meet the security requirements.';
    }

    // Return original message if no enhancement needed
    return message;
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
   * Extract context from exception
   */
  private extractExceptionContext(exception: any): Record<string, any> | undefined {
    // Check if exception has context property
    if (exception.context && typeof exception.context === 'object') {
      return exception.context;
    }

    // Check if exception response has context
    if (exception.response?.context && typeof exception.response.context === 'object') {
      return exception.response.context;
    }

    // Check if exception has getResponse method (NestJS exceptions)
    if (typeof exception.getResponse === 'function') {
      const response = exception.getResponse();
      if (typeof response === 'object' && response.context) {
        return response.context;
      }
    }

    return undefined;
  }

  /**
   * Build error extensions with additional context
   * Requirement 15.6, 19.5
   */
  private buildErrorExtensions(
    exception: any,
    errorCode: string,
    info: any,
    correlationId?: string,
  ): Record<string, any> {
    const extensions: Record<string, any> = {
      code: errorCode,
      timestamp: new Date().toISOString(),
    };

    // Add correlation ID for tracing
    if (correlationId && correlationId !== 'unknown') {
      extensions.correlationId = correlationId;
    }

    // Extract and add context from exception
    const context = this.extractExceptionContext(exception);
    if (context) {
      // Add suggestion if available
      if (context.suggestion) {
        extensions.suggestion = context.suggestion;
      }

      // Add action if available
      if (context.action) {
        extensions.action = context.action;
      }

      // Add alternatives if available
      if (context.alternatives) {
        extensions.alternatives = context.alternatives;
      }

      // Add any other context fields
      Object.keys(context).forEach(key => {
        if (!['suggestion', 'action', 'alternatives'].includes(key)) {
          extensions[key] = context[key];
        }
      });
    }

    // Add original technical message for debugging (sanitized)
    if (exception.message) {
      extensions.technicalMessage = this.removeSensitiveInfo(exception.message);
    }

    // Add status code
    if (exception.status || exception.statusCode) {
      extensions.statusCode = exception.status || exception.statusCode;
    }

    // Add Prisma-specific error details
    if (this.isPrismaError(exception)) {
      extensions.prismaCode = exception.code; // e.g., P2002
      if (exception.meta) {
        extensions.prismaMeta = exception.meta; // e.g., { target: ['name'] }
      }
    }

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
   * Check if error is a Prisma error
   */
  private isPrismaError(exception: any): boolean {
    return exception?.constructor?.name === 'PrismaClientKnownRequestError' ||
           exception?.constructor?.name === 'PrismaClientValidationError' ||
           exception?.constructor?.name === 'PrismaClientUnknownRequestError';
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
