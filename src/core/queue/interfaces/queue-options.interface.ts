import { JobOptions } from 'bull';

export enum QueueName {
  EMAIL = 'email',
  REPORT = 'report',
  NOTIFICATION = 'notification',
  INVOICE = 'invoice',
  STOCK = 'stock',
  INTEGRATION = 'integration',
  CLEANUP = 'cleanup',
  DEAD_LETTER = 'dead-letter',
  AUDIT = 'audit',
}

export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
  BACKGROUND = 5,
}

export interface QueueConfig {
  name: QueueName;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: JobOptions;
}

export interface JobData<T = any> {
  data: T;
  options?: JobOptions;
}

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}
