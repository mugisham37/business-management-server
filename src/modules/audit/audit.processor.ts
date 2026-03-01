import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditLogDto } from '../../common/types/audit.type';
import { LoggerService } from '../../core/logging/logger.service';
import { randomUUID } from 'crypto';

/**
 * Audit Processor
 * 
 * Processes audit log jobs from Bull queue asynchronously.
 * Writes audit logs to database without blocking main application flow.
 * 
 * Requirement 12.4: Process audit logs asynchronously
 * Requirement 12.5: Audit logs are immutable (append-only)
 */
@Processor('audit')
export class AuditProcessor {
  private readonly logger: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('AuditProcessor');
  }

  /**
   * Process audit log job
   * 
   * Requirement 12.1: Write audit record with all required fields
   * Requirement 12.5: Append-only, never update or delete
   * 
   * @param job - Bull job containing audit log data
   */
  @Process('log-action')
  async handleLogAction(job: Job<AuditLogDto>): Promise<void> {
    const dto = job.data;

    try {
      // Create immutable audit log record
      await this.prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          userId: dto.userId,
          organizationId: dto.organizationId,
          hierarchyLevel: dto.hierarchyLevel,
          action: dto.action,
          resourceType: dto.resourceType,
          resourceId: dto.resourceId,
          result: dto.result,
          metadata: dto.metadata || {},
          oldValue: dto.oldValue,
          newValue: dto.newValue,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });

      this.logger.logWithMetadata('debug', 'Audit log written', {
        action: dto.action,
        resourceType: dto.resourceType,
        userId: dto.userId,
        jobId: job.id,
      });
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed to write audit log for action ${dto.action}`,
        errorStack,
      );
      
      // Re-throw to trigger Bull retry mechanism
      throw error;
    }
  }
}
