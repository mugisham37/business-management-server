import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.prisma.ping();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        throw new HealthCheckError(
          'Database check failed',
          this.getStatus(key, false, { responseTime }),
        );
      }

      return this.getStatus(key, true, { responseTime });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { 
          responseTime,
          error: errorMessage 
        }),
      );
    }
  }
}
