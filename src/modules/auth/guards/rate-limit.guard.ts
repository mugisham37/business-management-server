import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RedisService } from '../../../core/cache/redis.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * Rate Limit Guard
 * Prevents brute force attacks by limiting requests per IP/email
 * Uses Redis for distributed rate limiting
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly maxAttempts = 5;
  private readonly windowSeconds = 900; // 15 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('RateLimitGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);
    const identifier = this.getIdentifier(request);

    if (!identifier) {
      // If we can't identify the request, allow it but log
      this.logger.warn('Rate limit check skipped - no identifier found');
      return true;
    }

    const key = `rate_limit:${identifier}`;

    try {
      // Get current attempt count
      const attempts = await this.redisService.get<number>(key);
      const currentAttempts = attempts || 0;

      if (currentAttempts >= this.maxAttempts) {
        const ttl = await this.redisService.ttl(key);
        const remainingMinutes = Math.ceil(ttl / 60);

        this.logger.logWithMetadata('warn', `Rate limit exceeded for ${identifier}`, {
          attempts: currentAttempts,
          maxAttempts: this.maxAttempts,
          remainingMinutes,
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many requests. Please try again in ${remainingMinutes} minutes.`,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment attempt count
      const newAttempts = await this.redisService.incr(key);

      // Set expiry on first attempt
      if (newAttempts === 1) {
        await this.redisService.getClient().expire(key, this.windowSeconds);
      }

      this.logger.logWithMetadata('debug', `Rate limit check passed for ${identifier}`, {
        attempts: newAttempts,
        maxAttempts: this.maxAttempts,
      });

      return true;
    } catch (error) {
      // If it's our rate limit exception, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // If Redis fails, log error but allow request (fail open)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Rate limit check failed - allowing request', errorMessage);
      return true;
    }
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
   * Get identifier for rate limiting (email or IP address)
   */
  private getIdentifier(request: any): string | null {
    // Try to get email from request body (login attempts)
    const email = request.body?.email || request.body?.variables?.email;
    if (email) {
      return `email:${email}`;
    }

    // Fall back to IP address
    const ip = request.ip || request.connection?.remoteAddress;
    if (ip) {
      return `ip:${ip}`;
    }

    return null;
  }
}
