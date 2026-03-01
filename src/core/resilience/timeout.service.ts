import { Injectable, Logger, RequestTimeoutException } from '@nestjs/common';

/**
 * Timeout Service
 * 
 * Provides timeout protection for async operations
 * 
 * Requirement 19.7
 */
@Injectable()
export class TimeoutService {
  private readonly logger = new Logger(TimeoutService.name);

  /**
   * Execute a function with timeout protection
   * 
   * @param fn - Function to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param context - Context for error message
   * @returns Result of the function
   * @throws RequestTimeoutException if timeout is exceeded
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    context?: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const message = context
          ? `Operation timed out after ${timeoutMs}ms (${context})`
          : `Operation timed out after ${timeoutMs}ms`;
        
        this.logger.warn(message);
        reject(new RequestTimeoutException(message));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      if (error instanceof RequestTimeoutException) {
        throw error;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Execute with timeout and fallback
   * If timeout is exceeded, execute fallback function
   * 
   * @param fn - Primary function to execute
   * @param fallback - Fallback function if timeout
   * @param timeoutMs - Timeout in milliseconds
   * @param context - Context for logging
   * @returns Result from primary or fallback function
   */
  async executeWithTimeoutAndFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
    timeoutMs: number,
    context?: string,
  ): Promise<T> {
    try {
      return await this.executeWithTimeout(fn, timeoutMs, context);
    } catch (error) {
      if (error instanceof RequestTimeoutException) {
        this.logger.warn(
          `Timeout exceeded, executing fallback${context ? ` (${context})` : ''}`,
        );
        return await fallback();
      }
      throw error;
    }
  }
}
