import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';
import { GrpcError } from '../interfaces';

/**
 * gRPC Error Formatting Interceptor
 * Catches and formats errors for gRPC protocol
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

    return next.handle().pipe(
      catchError((error) => {
        this.logger.error(`gRPC Error: ${error.message}`, error.stack);

        // If already an RpcException, pass it through
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        // Get correlation ID from metadata if available
        const metadata = context.getArgByIndex(1);
        const correlationId = metadata?.get('x-correlation-id')?.[0];

        // Map common errors to gRPC status codes
        const grpcError: GrpcError = this.mapErrorToGrpcError(
          error,
          correlationId,
        );

        return throwError(() => new RpcException(grpcError));
      }),
    );
  }

  private mapErrorToGrpcError(error: any, correlationId?: string): GrpcError {
    const timestamp = new Date().toISOString();

    // Map common error types
    if (error.name === 'UnauthorizedException') {
      return {
        code: 'UNAUTHENTICATED',
        message: error.message || 'Authentication required',
        timestamp,
        correlationId,
      };
    }

    if (error.name === 'ForbiddenException') {
      return {
        code: 'PERMISSION_DENIED',
        message: error.message || 'Permission denied',
        timestamp,
        correlationId,
      };
    }

    if (error.name === 'NotFoundException') {
      return {
        code: 'NOT_FOUND',
        message: error.message || 'Resource not found',
        timestamp,
        correlationId,
      };
    }

    if (error.name === 'BadRequestException') {
      return {
        code: 'INVALID_ARGUMENT',
        message: error.message || 'Invalid request',
        timestamp,
        correlationId,
      };
    }

    if (error.name === 'ConflictException') {
      return {
        code: 'ALREADY_EXISTS',
        message: error.message || 'Resource already exists',
        timestamp,
        correlationId,
      };
    }

    // Default to internal error
    return {
      code: 'INTERNAL',
      message: error.message || 'Internal server error',
      timestamp,
      correlationId,
      details: {
        type: error.name || 'Error',
      },
    };
  }
}
