import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { DatabaseModule } from '../../core/database/database.module';

/**
 * Audit Module
 * 
 * Handles immutable audit logging with async processing using Bull queues.
 * All actions are logged asynchronously to avoid blocking main requests.
 */
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'audit',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [AuditService, AuditProcessor],
  exports: [AuditService],
})
export class AuditModule {}
