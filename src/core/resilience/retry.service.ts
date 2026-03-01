import { Injectable, Logger } from '@nestjs/common';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;        // Maximum number of retry attempts
  initialDelay: number;       // Initial delay in ms
  maxDelay: number;           // Maximum delay in ms
  backoffMultiplier: number;  // Multiplier for exponential backoff
  retryableErrors?: string[]; // List of error names/codes to retry
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry Service
 * 
 * Implements retry logic with exponential backoff for transient failures
 * 
 * Requirement 19.7
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  /**
   * Execute a function with retry logic and exponential backoff
   * 
   * @param fn - Function to execute
   * @param config - Retry configuration
   * @param context - Context for logging
   * @returns Result of the function
   * @throws Last error if all retries fail
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string,
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;
    let delay = finalConfig.initialDelay;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        // Log success if this was a retry
        if (attempt > 1) {
          this.logger.log(
            `Operation succeeded on attempt ${attempt}${context ? ` (${context})` : ''}`,
          );
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error, finalConfig.retryableErrors)) {
          this.logger.warn(
            `Non-retryable error encountered${context ? ` (${context})` : ''}: ${lastError.message}`,
          );
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === finalConfig.maxAttempts) {
          this.logger.error(
            `Operation failed after ${attempt} attempts${context ? ` (${context})` : ''}: ${lastError.message}`,
          );
          throw lastError;
        }

        // Log retry attempt
        this.logger.warn(
          `Attempt ${attempt} failed${context ? ` (${context})` : ''}, retrying in ${delay}ms: ${lastError.message}`,
        );

        // Wait before retrying
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(
          delay * finalConfig.backoffMultiplier,
          finalConfig.maxDelay,
        );
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(
    error: any,
    retryableErrors?: string[],
  ): boolean {
    // If no specific retryable errors defined, retry all errors
    if (!retryableErrors || retryableErrors.length === 0) {
      return true;
    }

    // Check if error name or code matches retryable list
    const errorName = error.name || error.constructor?.name;
    const errorCode = error.code;

    return (
      retryableErrors.includes(errorName) ||
      (errorCode && retryableErrors.includes(errorCode))
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry and fallback
   * If all retries fail, execute fallback function
   * 
   * @param fn - Primary function to execute
   * @param fallback - Fallback function if primary fails
   * @param config - Retry configuration
   * @param context - Context for logging
   * @returns Result from primary or fallback function
   */
  async executeWithRetryAndFallback<T>(
    fn: () => Promise<T>,
    fallback: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string,
  ): Promise<T> {
    try {
      return await this.executeWithRetry(fn, config, context);
    } catch (error) {
      this.logger.warn(
        `Primary operation failed, executing fallback${context ? ` (${context})` : ''}`,
      );
      return await fallback();
    }
  }
}
