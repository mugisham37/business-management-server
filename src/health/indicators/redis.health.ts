import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../../core/cache/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      const client = this.redis.getClient();
      await client.ping();
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, { responseTime });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'Redis check failed',
        this.getStatus(key, false, { 
          responseTime,
          error: error.message 
        }),
      );
    }
  }
}
