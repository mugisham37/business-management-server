import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../logger.service';
import { Request, Response } from 'express';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * HTTP Logging Interceptor
 * 
 * Logs all incoming HTTP requests and their responses with:
 * - Request details (method, URL, headers, body)
 * - Response details (status code, duration)
 * - Error details (if request fails)
 * - GraphQL operation details (if applicable)
 * 
 * This interceptor works for both REST and GraphQL endpoints
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HttpLoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType<string>();

    // Handle GraphQL requests
    if (contextType === 'graphql') {
      return this.handleGraphQLRequest(context, next);
    }

    // Handle HTTP requests (REST)
    return this.handleHttpRequest(context, next);
  }

  /**
   * Handle HTTP/REST requests
   */
  private handleHttpRequest(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip, headers, body } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const correlationId = (request as any).correlationId || 'N/A';
    const contentType = headers['content-type'] || 'Unknown';

    const startTime = Date.now();

    // Log incoming request
    this.logger.info(
      `→ Incoming ${method} ${url}`,
      'HttpLoggingInterceptor',
    );
    
    this.logger.logWithMetadata(
      'info',
      'Request Details',
      {
        method,
        url,
        ip,
        userAgent,
        contentType,
        correlationId,
        bodySize: body ? JSON.stringify(body).length : 0,
        hasBody: !!body,
      },
      'HttpLoggingInterceptor',
    );

    // Log request body for debugging (only in development)
    if (process.env.NODE_ENV === 'development' && body) {
      this.logger.debug(
        `Request Body: ${JSON.stringify(body, null, 2)}`,
        'HttpLoggingInterceptor',
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.info(
            `← Response ${method} ${url} - ${statusCode} (${duration}ms)`,
            'HttpLoggingInterceptor',
          );

          this.logger.logWithMetadata(
            'info',
            'Response Details',
            {
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              correlationId,
              success: true,
            },
            'HttpLoggingInterceptor',
          );

          // Log response body for debugging (only in development)
          if (process.env.NODE_ENV === 'development' && data) {
            const responsePreview =
              typeof data === 'string'
                ? data.substring(0, 500)
                : JSON.stringify(data, null, 2).substring(0, 500);
            this.logger.debug(
              `Response Body Preview: ${responsePreview}${responsePreview.length >= 500 ? '...' : ''}`,
              'HttpLoggingInterceptor',
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;

          this.logger.error(
            `✗ Failed ${method} ${url} - ${statusCode} (${duration}ms)`,
            error.stack,
            'HttpLoggingInterceptor',
          );

          this.logger.logWithMetadata(
            'error',
            'Request Failed',
            {
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              correlationId,
              errorName: error.name,
              errorMessage: error.message,
              success: false,
            },
            'HttpLoggingInterceptor',
          );
        },
      }),
      catchError((error) => {
        // Re-throw the error after logging
        throw error;
      }),
    );
  }

  /**
   * Handle GraphQL requests
   */
  private handleGraphQLRequest(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const ctx = gqlContext.getContext();
    const request = ctx.req as Request;

    const operationType = info.operation?.operation || 'unknown';
    const operationName = info.operation?.name?.value || 'anonymous';
    const fieldName = info.fieldName;
    const parentType = info.parentType?.name || 'unknown';
    const correlationId = (request as any)?.correlationId ?? (ctx as any)?.correlationId ?? 'N/A';
    const userId = ctx.req?.user?.userId || 'anonymous';

    const startTime = Date.now();

    // Log incoming GraphQL operation
    this.logger.info(
      `→ GraphQL ${operationType.toUpperCase()}: ${operationName} (${parentType}.${fieldName})`,
      'HttpLoggingInterceptor',
    );

    this.logger.logWithMetadata(
      'info',
      'GraphQL Operation Details',
      {
        operationType,
        operationName,
        fieldName,
        parentType,
        correlationId,
        userId,
      },
      'HttpLoggingInterceptor',
    );

    // Log GraphQL variables (only in development)
    if (process.env.NODE_ENV === 'development' && info.variableValues) {
      this.logger.debug(
        `GraphQL Variables: ${JSON.stringify(info.variableValues, null, 2)}`,
        'HttpLoggingInterceptor',
      );
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;

          this.logger.info(
            `← GraphQL ${operationType.toUpperCase()}: ${operationName} - Success (${duration}ms)`,
            'HttpLoggingInterceptor',
          );

          this.logger.logWithMetadata(
            'info',
            'GraphQL Operation Completed',
            {
              operationType,
              operationName,
              fieldName,
              duration: `${duration}ms`,
              correlationId,
              success: true,
            },
            'HttpLoggingInterceptor',
          );

          // Log response data preview (only in development)
          if (process.env.NODE_ENV === 'development' && data) {
            const dataPreview = JSON.stringify(data, null, 2).substring(0, 500);
            this.logger.debug(
              `GraphQL Response Preview: ${dataPreview}${dataPreview.length >= 500 ? '...' : ''}`,
              'HttpLoggingInterceptor',
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          this.logger.error(
            `✗ GraphQL ${operationType.toUpperCase()}: ${operationName} - Failed (${duration}ms)`,
            error.stack,
            'HttpLoggingInterceptor',
          );

          this.logger.logWithMetadata(
            'error',
            'GraphQL Operation Failed',
            {
              operationType,
              operationName,
              fieldName,
              duration: `${duration}ms`,
              correlationId,
              errorName: error.name,
              errorMessage: error.message,
              errorCode: error.extensions?.code || 'UNKNOWN',
              success: false,
            },
            'HttpLoggingInterceptor',
          );
        },
      }),
      catchError((error) => {
        // Re-throw the error after logging
        throw error;
      }),
    );
  }
}
