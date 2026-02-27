import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../logger.service';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const correlationId = request.correlationId;

    const startTime = Date.now();

    this.logger.logWithMetadata(
      'info',
      `Incoming request: ${method} ${url}`,
      {
        method,
        url,
        ip,
        userAgent,
        correlationId,
      },
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.logWithMetadata(
            'info',
            `Request completed: ${method} ${url}`,
            {
              method,
              url,
              statusCode,
              duration,
              correlationId,
            },
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.logWithMetadata(
            'error',
            `Request failed: ${method} ${url}`,
            {
              method,
              url,
              statusCode,
              duration,
              correlationId,
              error: error.message,
              stack: error.stack,
            },
          );
        },
      }),
    );
  }
}
