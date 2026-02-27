import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  correlationId: string;
  userId?: string;
  tenantId?: string;
  [key: string]: any;
}

@Injectable()
export class CorrelationContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Run a function with a correlation context
   */
  run<T>(context: CorrelationContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get the current correlation context
   */
  getContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get the correlation ID from the current context
   */
  getCorrelationId(): string | undefined {
    return this.getContext()?.correlationId;
  }

  /**
   * Get the user ID from the current context
   */
  getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  /**
   * Get the tenant ID from the current context
   */
  getTenantId(): string | undefined {
    return this.getContext()?.tenantId;
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
