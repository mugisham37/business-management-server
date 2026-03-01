import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService, RequestContext } from './request-context.service';
import { UserContext } from '../../common/types/user-context.type';

/**
 * Request Context Interceptor
 * 
 * Extracts user context from the request and stores it in AsyncLocalStorage
 * so it can be accessed by Prisma middleware and other services.
 * 
 * This interceptor should be applied globally to all requests.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = this.getRequest(context);
    
    // Extract user context from request (set by JWT strategy)
    const user: UserContext | undefined = request.user;
    
    // Extract request metadata
    const ipAddress = this.getIpAddress(request);
    const userAgent = request.headers?.['user-agent'];
    const correlationId = request.correlationId || uuidv4();
    
    // Create request context
    const requestContext: RequestContext = {
      correlationId,
      user,
      ipAddress,
      userAgent,
    };
    
    // Run the request handler within the context
    return new Observable((subscriber) => {
      this.requestContextService.run(requestContext, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }

  /**
   * Get request from execution context (supports GraphQL and REST)
   */
  private getRequest(context: ExecutionContext): any {
    const type = context.getType();

    if (type === 'http') {
      return context.switchToHttp().getRequest();
    }

    // GraphQL context
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  /**
   * Extract IP address from request
   */
  private getIpAddress(request: any): string | undefined {
    return (
      request.headers?.['x-forwarded-for']?.split(',')[0] ||
      request.headers?.['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress
    );
  }
}
