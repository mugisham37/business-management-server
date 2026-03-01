import { Module, Global } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RetryService } from './retry.service';
import { TimeoutService } from './timeout.service';

/**
 * Resilience Module
 * 
 * Provides resilience patterns for handling failures:
 * - Circuit Breaker: Prevent cascading failures
 * - Retry: Handle transient failures with exponential backoff
 * - Timeout: Protect against hanging operations
 * 
 * Requirements: 19.6, 19.7
 */
@Global()
@Module({
  providers: [CircuitBreakerService, RetryService, TimeoutService],
  exports: [CircuitBreakerService, RetryService, TimeoutService],
})
export class ResilienceModule {}
