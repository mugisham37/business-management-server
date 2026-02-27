import { Resolver, Query } from '@nestjs/graphql';
import { HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../../../health/indicators/database.health';
import { RedisHealthIndicator } from '../../../health/indicators/redis.health';
import { HealthCheckResponse, ServiceHealth } from '../types';
import { BaseResolver } from './base.resolver';

@Resolver()
export class HealthResolver extends BaseResolver {
  constructor(
    private readonly healthService: HealthCheckService,
    private readonly databaseHealth: DatabaseHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {
    super(HealthResolver.name);
  }

  @Query(() => HealthCheckResponse, {
    description: 'Check health status of all services',
  })
  async health(): Promise<HealthCheckResponse> {
    try {
      const result = await this.healthService.check([
        () => this.databaseHealth.isHealthy('database'),
        () => this.redisHealth.isHealthy('cache'),
        () => this.redisHealth.isHealthy('queue'),
      ]);

      return {
        status: result.status,
        database: this.mapServiceHealth(result.info?.database),
        cache: this.mapServiceHealth(result.info?.cache),
        queue: this.mapServiceHealth(result.info?.queue),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Health check failed', error);

      // Return degraded status with error details
      return {
        status: 'error',
        database: { status: 'down', message: 'Health check failed' },
        cache: { status: 'down', message: 'Health check failed' },
        queue: { status: 'down', message: 'Health check failed' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  private mapServiceHealth(info: any): ServiceHealth {
    if (!info) {
      return { status: 'unknown' };
    }

    return {
      status: info.status || 'unknown',
      message: info.message,
    };
  }
}
