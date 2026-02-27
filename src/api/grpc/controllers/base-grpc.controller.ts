import { Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { GrpcError } from '../interfaces';

/**
 * Base gRPC controller with common functionality
 */
export abstract class BaseGrpcController {
  protected readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  /**
   * Handle errors and convert to gRPC exceptions
   */
  protected handleError(error: any, correlationId?: string): never {
    this.logger.error(`gRPC Error: ${error.message}`, error.stack);

    const grpcError: GrpcError = {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An internal error occurred',
      timestamp: new Date().toISOString(),
      correlationId,
      details: error.details || {},
    };

    throw new RpcException(grpcError);
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, fields: string[]): void {
    const missing = fields.filter((field) => !data[field]);
    
    if (missing.length > 0) {
      throw new RpcException({
        code: 'INVALID_ARGUMENT',
        message: `Missing required fields: ${missing.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log request with correlation ID
   */
  protected logRequest(method: string, data: any, correlationId?: string): void {
    this.logger.log({
      message: `gRPC Request: ${method}`,
      correlationId,
      data,
    });
  }

  /**
   * Log response with correlation ID
   */
  protected logResponse(method: string, correlationId?: string): void {
    this.logger.log({
      message: `gRPC Response: ${method}`,
      correlationId,
    });
  }
}
