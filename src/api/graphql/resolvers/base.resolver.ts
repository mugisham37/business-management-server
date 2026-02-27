import { Logger } from '@nestjs/common';

/**
 * Base Resolver
 * Provides common functionality for all GraphQL resolvers
 */
export abstract class BaseResolver {
  protected readonly logger: Logger;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Handle errors consistently across resolvers
   */
  protected handleError(error: any, operation: string): never {
    this.logger.error(`Error in ${operation}: ${error.message}`, error.stack);
    throw error;
  }

  /**
   * Log resolver operations
   */
  protected logOperation(operation: string, details?: any): void {
    this.logger.log(`${operation}${details ? `: ${JSON.stringify(details)}` : ''}`);
  }
}
