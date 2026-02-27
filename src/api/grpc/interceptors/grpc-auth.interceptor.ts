import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../../core/auth/interfaces';

/**
 * gRPC Authentication Interceptor
 * Validates JWT tokens from gRPC metadata
 */
@Injectable()
export class GrpcAuthInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const type = context.getType();

    // Only apply to gRPC requests
    if (type !== 'rpc') {
      return next.handle();
    }

    const metadata = context.getArgByIndex(1);
    const authHeader = metadata?.get('authorization')?.[0];

    if (!authHeader) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'Missing authentication token',
        timestamp: new Date().toISOString(),
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace('Bearer ', '');

    try {
      // Validate token
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Attach user context to metadata for downstream use
      metadata.set('user', JSON.stringify(payload));

      return next.handle();
    } catch (error) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
