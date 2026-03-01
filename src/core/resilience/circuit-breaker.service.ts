import { Injectable, Logger } from '@nestjs/common';

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  successThreshold: number;    // Number of successes to close from half-open
  timeout: number;             // Timeout in ms before attempting half-open
  requestTimeout: number;      // Individual request timeout in ms
}

/**
 * Circuit breaker statistics
 */
interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  state: CircuitState;
}

/**
 * Circuit Breaker Service
 * 
 * Implements circuit breaker pattern for external service calls
 * Prevents cascading failures by failing fast when service is down
 * 
 * Requirement 19.6
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitStats>();
  private readonly configs = new Map<string, CircuitBreakerConfig>();

  /**
   * Register a circuit breaker for a service
   */
  register(serviceName: string, config: CircuitBreakerConfig): void {
    this.configs.set(serviceName, config);
    this.circuits.set(serviceName, {
      failures: 0,
      successes: 0,
      state: CircuitState.CLOSED,
    });

    this.logger.log(`Circuit breaker registered for ${serviceName}`, {
      config,
    });
  }

  /**
   * Execute a function with circuit breaker protection
   * 
   * @param serviceName - Name of the service
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(
    serviceName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const config = this.configs.get(serviceName);
    if (!config) {
      throw new Error(`Circuit breaker not registered for ${serviceName}`);
    }

    const stats = this.circuits.get(serviceName)!;

    // Check circuit state
    if (stats.state === CircuitState.OPEN) {
      // Check if timeout has passed to try half-open
      if (
        stats.lastFailureTime &&
        Date.now() - stats.lastFailureTime >= config.timeout
      ) {
        this.logger.log(`Circuit breaker entering HALF_OPEN state for ${serviceName}`);
        stats.state = CircuitState.HALF_OPEN;
        stats.successes = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${serviceName}. Service is unavailable.`,
        );
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn, config.requestTimeout);

      // Record success
      this.recordSuccess(serviceName);

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(serviceName);

      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout),
      ),
    ]);
  }

  /**
   * Record successful execution
   */
  private recordSuccess(serviceName: string): void {
    const stats = this.circuits.get(serviceName)!;
    const config = this.configs.get(serviceName)!;

    stats.successes++;
    stats.failures = 0;

    // If in HALF_OPEN state and reached success threshold, close circuit
    if (
      stats.state === CircuitState.HALF_OPEN &&
      stats.successes >= config.successThreshold
    ) {
      this.logger.log(`Circuit breaker CLOSED for ${serviceName}`);
      stats.state = CircuitState.CLOSED;
      stats.successes = 0;
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(serviceName: string): void {
    const stats = this.circuits.get(serviceName)!;
    const config = this.configs.get(serviceName)!;

    stats.failures++;
    stats.lastFailureTime = Date.now();

    // If in HALF_OPEN state, immediately open circuit
    if (stats.state === CircuitState.HALF_OPEN) {
      this.logger.warn(`Circuit breaker OPEN for ${serviceName} (failed in HALF_OPEN)`);
      stats.state = CircuitState.OPEN;
      stats.successes = 0;
      return;
    }

    // If reached failure threshold, open circuit
    if (stats.failures >= config.failureThreshold) {
      this.logger.warn(
        `Circuit breaker OPEN for ${serviceName} (${stats.failures} failures)`,
      );
      stats.state = CircuitState.OPEN;
    }
  }

  /**
   * Get circuit state for a service
   */
  getState(serviceName: string): CircuitState | undefined {
    return this.circuits.get(serviceName)?.state;
  }

  /**
   * Get circuit statistics for a service
   */
  getStats(serviceName: string): CircuitStats | undefined {
    return this.circuits.get(serviceName);
  }

  /**
   * Manually reset a circuit breaker
   */
  reset(serviceName: string): void {
    const stats = this.circuits.get(serviceName);
    if (stats) {
      stats.state = CircuitState.CLOSED;
      stats.failures = 0;
      stats.successes = 0;
      stats.lastFailureTime = undefined;
      this.logger.log(`Circuit breaker manually reset for ${serviceName}`);
    }
  }
}
