import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../core/logging/logger.service';
import { BaseException } from '../exceptions/base.exception';
import { Prisma } from '@prisma/client';

/**
 * Global exception filter that catches all exceptions
 * and formats them appropriately for different protocols
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('GlobalExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, code, message, metadata } = this.parseException(exception);

    // Log the error with full context
    this.logger.error(
      `Exception caught: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    // Format error response
    const errorResponse = {
      statusCode,
      code,
      message: this.sanitizeErrorMessage(message, statusCode),
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId: request['correlationId'],
      ...(metadata && { metadata }),
    };

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Parse exception to extract status code, code, message, and metadata
   */
  private parseException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    metadata?: Record<string, any>;
  } {
    // Handle custom BaseException
    if (exception instanceof BaseException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        metadata: exception.metadata,
      };
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      
      return {
        statusCode: status,
        code: this.getHttpStatusCode(status),
        message: typeof response === 'string' ? response : (response as any).message || exception.message,
        metadata: typeof response === 'object' ? response : undefined,
      };
    }

    // Handle Prisma errors
    if (this.isPrismaError(exception)) {
      return this.mapPrismaError(exception as Prisma.PrismaClientKnownRequestError);
    }

    // Handle generic errors
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: exception.message,
      };
    }

    // Handle unknown errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  /**
   * Check if error is a Prisma error
   */
  private isPrismaError(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    );
  }

  /**
   * Map Prisma errors to appropriate HTTP status codes
   */
  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    code: string;
    message: string;
    metadata?: Record<string, any>;
  } {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this value already exists',
          metadata: { fields: error.meta?.target },
        };
      
      case 'P2003': // Foreign key constraint violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'Referenced record does not exist',
          metadata: { field: error.meta?.field_name },
        };
      
      case 'P2025': // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
        };
      
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'DATABASE_ERROR',
          message: 'A database error occurred',
          metadata: { prismaCode: error.code },
        };
    }
  }

  /**
   * Get HTTP status code name
   */
  private getHttpStatusCode(status: number): string {
    const statusMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    return statusMap[status] || 'UNKNOWN_ERROR';
  }

  /**
   * Sanitize error message to prevent information leakage
   */
  private sanitizeErrorMessage(message: string, statusCode: number): string {
    // In production, return generic messages for server errors
    if (
      process.env.NODE_ENV === 'production' &&
      statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
    ) {
      return 'An internal server error occurred';
    }

    // Remove sensitive patterns
    const sensitivePatterns = [
      /password[=:]\s*\S+/gi,
      /token[=:]\s*\S+/gi,
      /secret[=:]\s*\S+/gi,
      /api[_-]?key[=:]\s*\S+/gi,
      /connection[_-]?string[=:]\s*\S+/gi,
      /\/[\w-]+\/[\w-]+\/[\w-]+\//g, // File paths
    ];

    let sanitized = message;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }
}
