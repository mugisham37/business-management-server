import { PrismaService } from './prisma.service';

/**
 * Transaction Context
 * 
 * Stores the current transaction client in async context.
 * This allows nested method calls to participate in the same transaction.
 */
class TransactionContext {
  private static context = new Map<string, any>();

  static set(key: string, value: any): void {
    this.context.set(key, value);
  }

  static get(key: string): any {
    return this.context.get(key);
  }

  static delete(key: string): void {
    this.context.delete(key);
  }

  static has(key: string): boolean {
    return this.context.has(key);
  }
}

/**
 * Transaction Decorator
 * 
 * Wraps method execution in a Prisma transaction.
 * All database operations within the method will be part of the same transaction.
 * 
 * Features:
 * - Automatic transaction management
 * - Rollback on error
 * - Transaction context propagation
 * - Nested transaction support
 * 
 * Usage:
 * ```typescript
 * @Transaction()
 * async transferFunds(from: string, to: string, amount: number): Promise<void> {
 *   await this.debit(from, amount);
 *   await this.credit(to, amount);
 * }
 * ```
 * 
 * Note: The class must have a 'prisma' property of type PrismaService
 */
export function Transaction(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const prisma: PrismaService = (this as any).prisma;

      if (!prisma) {
        throw new Error(
          `@Transaction decorator requires a 'prisma' property of type PrismaService in ${target.constructor.name}`,
        );
      }

      // Generate unique transaction ID for this execution
      const transactionId = `tx_${Date.now()}_${Math.random()}`;

      // Check if we're already in a transaction
      if (TransactionContext.has('currentTransaction')) {
        // Reuse existing transaction
        return originalMethod.apply(this, args);
      }

      // Start new transaction
      try {
        return await prisma.$transaction(async (tx) => {
          // Store transaction client in context
          TransactionContext.set('currentTransaction', tx);
          TransactionContext.set('transactionId', transactionId);

          // Replace prisma instance with transaction client temporarily
          const originalPrisma = (this as any).prisma;
          (this as any).prisma = tx;

          try {
            // Execute the method
            const result = await originalMethod.apply(this, args);
            return result;
          } finally {
            // Restore original prisma instance
            (this as any).prisma = originalPrisma;
          }
        });
      } finally {
        // Clean up transaction context
        TransactionContext.delete('currentTransaction');
        TransactionContext.delete('transactionId');
      }
    };

    return descriptor;
  };
}

/**
 * Get current transaction client if in transaction context
 * Returns null if not in a transaction
 */
export function getCurrentTransaction(): any | null {
  return TransactionContext.get('currentTransaction') || null;
}

/**
 * Get current transaction ID if in transaction context
 * Returns null if not in a transaction
 */
export function getCurrentTransactionId(): string | null {
  return TransactionContext.get('transactionId') || null;
}

/**
 * Check if currently in a transaction
 */
export function isInTransaction(): boolean {
  return TransactionContext.has('currentTransaction');
}
