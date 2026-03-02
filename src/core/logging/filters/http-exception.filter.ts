import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger.service';

/**
 * HTTP Exception Filter
 * 
 * Catches all HTTP exceptions (including 404 errors) and:
 * - Logs the error with full context
 * - Returns a consistent error response format
 * - Sanitizes error messages for production
 * 
 * This filter handles REST API errors (not GraphQL)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const correlationId = (request as any).correlationId || 'N/A';

    // Log the error
    this.logger.error(
      `HTTP Exception: ${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : undefined,
      'HttpExceptionFilter',
    );

    this.logger.logWithMetadata(
      'error',
      'HTTP Exception Details',
      {
        method: request.method,
        url: request.url,
        statusCode: status,
        correlationId,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        errorMessage: message,
        errorType: exception instanceof Error ? exception.constructor.name : 'Unknown',
      },
      'HttpExceptionFilter',
    );

    // Build error response
    const errorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse as any).message || message,
      error:
        typeof errorResponse === 'object' && 'error' in errorResponse
          ? (errorResponse as any).error
          : this.getErrorName(status),
      correlationId,
    };

    // Log the error response being sent
    this.logger.logWithMetadata(
      'info',
      'Sending Error Response',
      {
        statusCode: status,
        correlationId,
        responseBody: errorResponseBody,
      },
      'HttpExceptionFilter',
    );

    response.status(status).json(errorResponseBody);
  }

  /**
   * Get error name from status code
   */
  private getErrorName(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 409:
        return 'Conflict';
      case 422:
        return 'Unprocessable Entity';
      case 429:
        return 'Too Many Requests';
      case 500:
        return 'Internal Server Error';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      default:
        return 'Error';
    }
  }
}
