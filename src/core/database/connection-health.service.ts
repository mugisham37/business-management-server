import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LoggerService } from '../logging/logger.service';

/**
 * Connection Health Service
 * 
 * Monitors database connection health and provides recovery mechanisms
 */
@Injectable()
export class ConnectionHealthService {
  private isHealthy = true;
  private lastCheckTime: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ConnectionHealthService');
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    this.logger.info('Starting database connection health checks');
    
    setInterval(async () => {
      await this.checkHealth();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check database connection health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.prisma.ping();
      
      if (isHealthy) {
        if (!this.isHealthy) {
          this.logger.info('Database connection recovered');
        }
        this.isHealthy = true;
        this.consecutiveFailures = 0;
      } else {
        this.handleUnhealthy();
      }
      
      this.lastCheckTime = new Date();
      return isHealthy;
    } catch (error) {
      this.handleUnhealthy();
      this.lastCheckTime = new Date();
      return false;
    }
  }

  /**
   * Handle unhealthy connection state
   */
  private handleUnhealthy(): void {
    this.consecutiveFailures++;
    this.isHealthy = false;
    
    this.logger.warn(
      `Database connection unhealthy (${this.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES} failures)`,
    );

    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.logger.error(
        'Database connection critically unhealthy - consider restarting the application',
      );
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    lastCheckTime: Date | null;
    consecutiveFailures: number;
  } {
    return {
      isHealthy: this.isHealthy,
      lastCheckTime: this.lastCheckTime,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
