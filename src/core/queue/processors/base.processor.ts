import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { BullService } from '../bull.service';

export abstract class BaseProcessor {
  protected readonly logger: Logger;
  protected bullService?: BullService;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Set the Bull service for dead letter queue functionality
   */
  setBullService(bullService: BullService): void {
    this.bullService = bullService;
  }

  /**
   * Handle job processing with error handling and logging
   */
  protected async handleJob<T>(
    job: Job<T>,
    processFunction: (data: T, job: Job<T>) => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Processing job ${job.id} (${job.name}) - Attempt ${job.attemptsMade + 1}`);

    try {
      await processFunction(job.data, job);
      const duration = Date.now() - startTime;
      this.logger.log(`Job ${job.id} completed successfully in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Job ${job.id} failed after ${duration}ms - Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Update job progress
   */
  protected async updateProgress(job: Job, progress: number): Promise<void> {
    await job.progress(progress);
    this.logger.debug(`Job ${job.id} progress: ${progress}%`);
  }

  /**
   * Log job progress with message
   */
  protected logProgress(job: Job, message: string, progress?: number): void {
    if (progress !== undefined) {
      job.progress(progress);
    }
    this.logger.debug(`Job ${job.id}: ${message}`);
  }

  /**
   * Determine if error is retriable
   */
  protected isRetriableError(error: Error): boolean {
    // Network errors, timeouts, and temporary failures are retriable
    const retriableErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'EPIPE',
      'NetworkError',
      'TimeoutError',
    ];

    return retriableErrors.some((retriable) =>
      error.message?.includes(retriable) || error.name?.includes(retriable),
    );
  }

  /**
   * Handle job failure
   */
  protected async onJobFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed permanently after ${job.attemptsMade} attempts`,
      error.stack,
    );

    // Move to dead letter queue if all retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      if (this.bullService) {
        try {
          await this.bullService.moveToDeadLetterQueue(job, error.message);
        } catch (dlqError) {
          this.logger.error(
            `Failed to move job ${job.id} to dead letter queue`,
            dlqError instanceof Error ? dlqError.stack : String(dlqError),
          );
        }
      }
    }
  }

  /**
   * Handle job completion
   */
  protected async onJobCompleted(job: Job, result: any): Promise<void> {
    this.logger.log(`Job ${job.id} (${job.name}) completed with result: ${JSON.stringify(result)}`);
  }
}
