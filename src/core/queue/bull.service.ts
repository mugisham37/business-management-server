import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Bull from 'bull';
import type { Queue, Job, JobOptions } from 'bull';
import {
  QueueName,
  QueueConfig,
  QueueStatus,
  JobData,
} from './interfaces';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class BullService implements OnModuleDestroy {
  private readonly logger: LoggerService;
  private readonly queues: Map<QueueName, Queue> = new Map();

  constructor(
    private readonly config: { redis: { host: string; port: number; password?: string } },
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;
    this.logger.setContext('BullService');
  }

  /**
   * Initialize a queue with the given configuration
   */
  initializeQueue(queueName: QueueName, defaultJobOptions?: JobOptions): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const queue = new Bull(queueName, {
      redis: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...defaultJobOptions,
      },
    });

    // Add event listeners for job lifecycle logging
    queue.on('active', (job: Job) => {
      this.logger.logWithMetadata('info', `Job started`, {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        status: 'active',
      });
    });

    queue.on('completed', (job: Job, result: any) => {
      this.logger.logWithMetadata('info', `Job completed`, {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        status: 'completed',
        duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0,
      });
    });

    queue.on('failed', (job: Job, error: Error) => {
      this.logger.logWithMetadata('error', `Job failed`, {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        status: 'failed',
        attemptsMade: job.attemptsMade,
        error: error.message,
        stack: error.stack,
      });
    });

    queue.on('stalled', (job: Job) => {
      this.logger.logWithMetadata('warn', `Job stalled`, {
        queue: queueName,
        jobId: job.id,
        jobName: job.name,
        status: 'stalled',
      });
    });

    this.queues.set(queueName, queue);
    this.logger.info(`Queue "${queueName}" initialized`);

    return queue;
  }

  /**
   * Get a queue by name
   */
  getQueue(queueName: QueueName): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found. Did you initialize it?`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: JobOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    this.logger.debug(`Job "${jobName}" added to queue "${queueName}" with ID ${job.id}`);
    return job;
  }

  /**
   * Add a scheduled job with cron expression
   */
  async addScheduledJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    cronExpression: string,
    options?: JobOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      ...options,
      repeat: {
        cron: cronExpression,
      },
    });
    this.logger.info(
      `Scheduled job "${jobName}" added to queue "${queueName}" with cron: ${cronExpression}`,
    );
    return job;
  }

  /**
   * Add a job with priority
   */
  async addJobWithPriority<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    priority: number,
    options?: JobOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      ...options,
      priority,
    });
    this.logger.debug(
      `Job "${jobName}" added to queue "${queueName}" with priority ${priority} and ID ${job.id}`,
    );
    return job;
  }

  /**
   * Add multiple jobs to a queue
   */
  async addBulk<T>(
    queueName: QueueName,
    jobs: Array<{ name: string; data: T; options?: JobOptions }>,
  ): Promise<Job<T>[]> {
    const queue = this.getQueue(queueName);
    const bullJobs = await queue.addBulk(
      jobs.map((job) => ({
        name: job.name,
        data: job.data,
        opts: job.options,
      })),
    );
    this.logger.debug(`${jobs.length} jobs added to queue "${queueName}"`);
    return bullJobs;
  }

  /**
   * Get a job by ID
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Remove a job from a queue
   */
  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.debug(`Job ${jobId} removed from queue "${queueName}"`);
    }
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.info(`Queue "${queueName}" paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.info(`Queue "${queueName}" resumed`);
  }

  /**
   * Get queue status
   */
  async getQueueStatus(queueName: QueueName): Promise<QueueStatus> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      name: queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get all repeatable jobs in a queue
   */
  async getRepeatableJobs(queueName: QueueName): Promise<any[]> {
    const queue = this.getQueue(queueName);
    return queue.getRepeatableJobs();
  }

  /**
   * Remove a repeatable job
   */
  async removeRepeatableJob(
    queueName: QueueName,
    jobName: string,
    repeatOptions: any,
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.removeRepeatableByKey(`${jobName}:${repeatOptions.cron}`);
    this.logger.info(`Repeatable job "${jobName}" removed from queue "${queueName}"`);
  }

  /**
   * Move a failed job to the dead letter queue
   */
  async moveToDeadLetterQueue<T>(job: Job<T>, reason: string): Promise<Job<T>> {
    const dlqData = {
      originalQueue: job.queue.name,
      originalJobId: job.id,
      originalJobName: job.name,
      originalData: job.data,
      failureReason: reason,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
      stackTrace: job.stacktrace,
    };

    const dlq = this.getQueue(QueueName.DEAD_LETTER);
    const dlqJob = await dlq.add('failed-job', dlqData, {
      removeOnComplete: false,
      removeOnFail: false,
    });

    this.logger.warn(
      `Job ${job.id} from queue "${job.queue.name}" moved to dead letter queue. Reason: ${reason}`,
    );

    return dlqJob;
  }

  /**
   * Get all jobs in the dead letter queue
   */
  async getDeadLetterJobs(): Promise<Job[]> {
    const dlq = this.getQueue(QueueName.DEAD_LETTER);
    return dlq.getJobs(['completed', 'waiting', 'active', 'delayed', 'failed']);
  }

  /**
   * Retry a job from the dead letter queue
   */
  async retryFromDeadLetterQueue(dlqJobId: string): Promise<Job | null> {
    const dlq = this.getQueue(QueueName.DEAD_LETTER);
    const dlqJob = await dlq.getJob(dlqJobId);

    if (!dlqJob) {
      this.logger.warn(`Dead letter job ${dlqJobId} not found`);
      return null;
    }

    const jobData = dlqJob.data as any;
    const originalQueue = this.getQueue(jobData.originalQueue as QueueName);

    // Re-add the job to the original queue
    const retriedJob = await originalQueue.add(jobData.originalJobName, jobData.originalData, {
      attempts: 3,
    });

    // Remove from dead letter queue
    await dlqJob.remove();

    this.logger.info(
      `Job ${dlqJobId} retried from dead letter queue to "${jobData.originalQueue}"`,
    );

    return retriedJob;
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    queueName: QueueName,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
  ): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    return queue.getJobs([status]);
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(queueName: QueueName, grace: number = 0): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, 'completed');
    this.logger.info(`Cleaned completed jobs from queue "${queueName}"`);
  }

  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(queueName: QueueName, grace: number = 0): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, 'failed');
    this.logger.info(`Cleaned failed jobs from queue "${queueName}"`);
  }

  /**
   * Empty a queue (remove all jobs)
   */
  async emptyQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.empty();
    this.logger.warn(`Queue "${queueName}" emptied`);
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.retry();
      this.logger.info(`Job ${jobId} from queue "${queueName}" retried`);
    }
  }

  /**
   * Promote a delayed job to be processed immediately
   */
  async promoteJob(queueName: QueueName, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.promote();
      this.logger.info(`Job ${jobId} from queue "${queueName}" promoted`);
    }
  }

  /**
   * Get job counts for all queues
   */
  async getAllQueueStatuses(): Promise<QueueStatus[]> {
    const statuses: QueueStatus[] = [];
    for (const queueName of Object.values(QueueName)) {
      const status = await this.getQueueStatus(queueName as QueueName);
      statuses.push(status);
    }
    return statuses;
  }

  /**
   * Get all queues
   */
  getAllQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('Closing all queues...');
    await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => {
        await queue.close();
      }),
    );
    this.logger.info('All queues closed');
  }
}
