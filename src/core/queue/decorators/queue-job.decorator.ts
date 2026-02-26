import type { JobOptions } from 'bull';
import { JobPriority } from '../interfaces';

/**
 * Decorator to define default job options for a processor method
 */
export function QueueJob(options?: JobOptions): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('queue:job:options', options, target, propertyKey);
    return descriptor;
  };
}

/**
 * Helper to create job options with priority
 */
export function createJobOptions(
  priority: JobPriority,
  additionalOptions?: Partial<JobOptions>,
): JobOptions {
  return {
    priority,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: getDefaultAttemptsForPriority(priority),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    ...additionalOptions,
  };
}

/**
 * Helper to create scheduled job options with cron
 */
export function createScheduledJobOptions(
  cronExpression: string,
  priority: JobPriority = JobPriority.MEDIUM,
  additionalOptions?: Partial<JobOptions>,
): JobOptions {
  return {
    ...createJobOptions(priority, additionalOptions),
    repeat: {
      cron: cronExpression,
    },
  };
}

/**
 * Get default retry attempts based on priority
 */
function getDefaultAttemptsForPriority(priority: JobPriority): number {
  switch (priority) {
    case JobPriority.CRITICAL:
      return 5;
    case JobPriority.HIGH:
      return 4;
    case JobPriority.MEDIUM:
      return 3;
    case JobPriority.LOW:
      return 2;
    case JobPriority.BACKGROUND:
      return 1;
    default:
      return 3;
  }
}
