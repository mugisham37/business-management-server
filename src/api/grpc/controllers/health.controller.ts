import { Controller } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import type {
  HealthCheckRequest,
  HealthCheckResponse,
} from '../interfaces';
import {
  ComponentHealth,
  ServingStatus,
  ComponentHealthStatus,
} from '../interfaces';
import { BaseGrpcController } from './base-grpc.controller';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../../../core/cache/redis.service';

/**
 * gRPC Health Check Controller
 */
@Controller()
export class HealthController extends BaseGrpcController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super(HealthController.name);
  }

  /**
   * Check health status
   */
  @GrpcMethod('HealthService', 'Check')
  async check(data: HealthCheckRequest): Promise<HealthCheckResponse> {
    this.logRequest('Check', data);

    try {
      const components: Record<string, ComponentHealth> = {};

      // Check database health
      components.database = await this.checkDatabase();

      // Check cache health
      components.cache = await this.checkCache();

      // Check queue health (using same Redis connection)
      components.queue = await this.checkQueue();

      // Determine overall status
      const overallStatus = this.determineOverallStatus(components);

      const response: HealthCheckResponse = {
        status: overallStatus,
        components,
        timestamp: new Date().toISOString(),
      };

      this.logResponse('Check');
      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Watch health status (streaming)
   */
  @GrpcStreamMethod('HealthService', 'Watch')
  watch(data: HealthCheckRequest): Observable<HealthCheckResponse> {
    this.logRequest('Watch', data);

    // Stream health checks every 5 seconds
    return interval(5000).pipe(
      switchMap(async () => {
        return await this.check(data);
      }),
    );
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return {
        status: ComponentHealthStatus.HEALTHY,
        message: 'Database connection is healthy',
      };
    } catch (error: any) {
      return {
        status: ComponentHealthStatus.UNHEALTHY,
        message: 'Database connection failed',
        details: { error: error?.message || 'Unknown error' },
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCache(): Promise<ComponentHealth> {
    try {
      const client = this.redisService.getClient();
      await client.ping();
      return {
        status: ComponentHealthStatus.HEALTHY,
        message: 'Cache connection is healthy',
      };
    } catch (error: any) {
      return {
        status: ComponentHealthStatus.UNHEALTHY,
        message: 'Cache connection failed',
        details: { error: error?.message || 'Unknown error' },
      };
    }
  }

  /**
   * Check queue health
   */
  private async checkQueue(): Promise<ComponentHealth> {
    try {
      // Queue uses the same Redis connection
      const client = this.redisService.getClient();
      await client.ping();
      return {
        status: ComponentHealthStatus.HEALTHY,
        message: 'Queue connection is healthy',
      };
    } catch (error: any) {
      return {
        status: ComponentHealthStatus.UNHEALTHY,
        message: 'Queue connection failed',
        details: { error: error?.message || 'Unknown error' },
      };
    }
  }

  /**
   * Determine overall serving status based on components
   */
  private determineOverallStatus(
    components: Record<string, ComponentHealth>,
  ): ServingStatus {
    const statuses = Object.values(components).map((c) => c.status);

    // If any component is unhealthy, service is not serving
    if (statuses.includes(ComponentHealthStatus.UNHEALTHY)) {
      return ServingStatus.NOT_SERVING;
    }

    // If any component is degraded, but none unhealthy
    if (statuses.includes(ComponentHealthStatus.DEGRADED)) {
      return ServingStatus.NOT_SERVING;
    }

    // All components healthy
    if (statuses.every((s) => s === ComponentHealthStatus.HEALTHY)) {
      return ServingStatus.SERVING;
    }

    return ServingStatus.UNKNOWN;
  }
}
