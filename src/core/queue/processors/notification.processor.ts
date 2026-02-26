import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { BaseProcessor } from './base.processor';
import { QueueName } from '../interfaces';

export interface NotificationJobData {
  userId: string;
  type: 'push' | 'sms' | 'in-app';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

@Processor(QueueName.NOTIFICATION)
export class NotificationProcessor extends BaseProcessor {
  constructor() {
    super(NotificationProcessor.name);
  }

  @Process('send-notification')
  async handleSendNotification(job: Job<NotificationJobData>): Promise<void> {
    await this.handleJob(job, async (data, job) => {
      await this.updateProgress(job, 20);

      // Validate notification data
      this.validateNotificationData(data);
      await this.updateProgress(job, 40);

      // Send notification based on type
      switch (data.type) {
        case 'push':
          await this.sendPushNotification(data);
          break;
        case 'sms':
          await this.sendSmsNotification(data);
          break;
        case 'in-app':
          await this.sendInAppNotification(data);
          break;
        default:
          throw new Error(`Unknown notification type: ${data.type}`);
      }

      await this.updateProgress(job, 100);
    });
  }

  @Process('send-push')
  async handleSendPush(
    job: Job<{ userId: string; title: string; message: string }>,
  ): Promise<void> {
    await this.handleJob(job, async (data) => {
      const notificationData: NotificationJobData = {
        userId: data.userId,
        type: 'push',
        title: data.title,
        message: data.message,
      };
      await this.sendPushNotification(notificationData);
    });
  }

  @Process('send-sms')
  async handleSendSms(
    job: Job<{ userId: string; message: string }>,
  ): Promise<void> {
    await this.handleJob(job, async (data) => {
      const notificationData: NotificationJobData = {
        userId: data.userId,
        type: 'sms',
        title: '',
        message: data.message,
      };
      await this.sendSmsNotification(notificationData);
    });
  }

  @OnQueueCompleted()
  async onCompleted(job: Job, result: any): Promise<void> {
    await this.onJobCompleted(job, result);
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error): Promise<void> {
    await this.onJobFailed(job, error);
  }

  private validateNotificationData(data: NotificationJobData): void {
    if (!data.userId || !data.type || !data.message) {
      throw new Error('User ID, notification type, and message are required');
    }
  }

  private async sendPushNotification(data: NotificationJobData): Promise<void> {
    // Simulate push notification sending
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.logger.debug(`Push notification sent to user ${data.userId}: ${data.title}`);
  }

  private async sendSmsNotification(data: NotificationJobData): Promise<void> {
    // Simulate SMS sending
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.logger.debug(`SMS sent to user ${data.userId}`);
  }

  private async sendInAppNotification(data: NotificationJobData): Promise<void> {
    // Simulate in-app notification creation
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.logger.debug(`In-app notification created for user ${data.userId}`);
  }
}
