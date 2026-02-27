import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

/**
 * gRPC Validation Interceptor
 * Validates request data using class-validator
 */
@Injectable()
export class GrpcValidationInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const type = context.getType();

    // Only apply to gRPC requests
    if (type !== 'rpc') {
      return next.handle();
    }

    const data = context.getArgByIndex(0);
    const handler = context.getHandler();

    // Get the DTO class from method metadata if available
    const dtoClass = Reflect.getMetadata('grpc:dto', handler);

    if (!dtoClass) {
      // No DTO specified, skip validation
      return next.handle();
    }

    // Transform plain object to class instance
    const dtoInstance = plainToInstance(dtoClass, data);

    // Validate
    const errors = await validate(dtoInstance);

    if (errors.length > 0) {
      const messages = errors.map((error) => ({
        field: error.property,
        constraints: Object.values(error.constraints || {}),
      }));

      throw new RpcException({
        code: 'INVALID_ARGUMENT',
        message: 'Validation failed',
        details: { errors: JSON.stringify(messages) },
        timestamp: new Date().toISOString(),
      });
    }

    return next.handle();
  }
}
