import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { UserContext } from '../../common/types/user-context.type';

/**
 * Request context stored in AsyncLocalStorage
 */
export interface RequestContext {
  correlationId: string;
  user?: UserContext;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: any;
}

/**
 * Request Context Service
 * 
 * Manages request-scoped context using AsyncLocalStorage.
 * This allows passing user context to Prisma middleware and other services
 * without explicit parameter passing.
 */
@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function with a request context
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get the current request context
   */
  getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get the correlation ID from the current context
   */
  getCorrelationId(): string | undefined {
    return this.getContext()?.correlationId;
  }

  /**
   * Get the user context from the current request
   */
  getUserContext(): UserContext | undefined {
    return this.getContext()?.user;
  }

  /**
   * Get the IP address from the current request
   */
  getIpAddress(): string | undefined {
    return this.getContext()?.ipAddress;
  }

  /**
   * Get the user agent from the current request
   */
  getUserAgent(): string | undefined {
    return this.getContext()?.userAgent;
  }

  /**
   * Set a value in the current context
   */
  set(key: string, value: any): void {
    const context = this.getContext();
    if (context) {
      context[key] = value;
    }
  }

  /**
   * Get a value from the current context
   */
  get(key: string): any {
    return this.getContext()?.[key];
  }
}
