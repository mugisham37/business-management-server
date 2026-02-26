import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import type { Job } from 'bull';
import { BaseProcessor } from './base.processor';
import { QueueName } from '../interfaces';

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

@Processor(QueueName.EMAIL)
export class EmailProcessor extends BaseProcessor {
  constructor() {
    super(EmailProcessor.name);
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJobData>): Promise<void> {
    await this.handleJob(job, async (data, job) => {
      await this.updateProgress(job, 10);
      
      // Validate email data
      this.validateEmailData(data);
      await this.updateProgress(job, 30);

      // Simulate email sending (replace with actual email service)
      this.logger.log(`Sending email to ${data.to} with subject: ${data.subject}`);
      await this.simulateEmailSend(data);
      await this.updateProgress(job, 100);
    });
  }

  @Process('send-welcome')
  async handleSendWelcome(job: Job<{ email: string; name: string }>): Promise<void> {
    await this.handleJob(job, async (data) => {
      const emailData: EmailJobData = {
        to: data.email,
        subject: 'Welcome!',
        template: 'welcome',
        context: { name: data.name },
      };
      await this.simulateEmailSend(emailData);
    });
  }

  @Process('send-password-reset')
  async handleSendPasswordReset(
    job: Job<{ email: string; resetToken: string }>,
  ): Promise<void> {
    await this.handleJob(job, async (data) => {
      const emailData: EmailJobData = {
        to: data.email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: { resetToken: data.resetToken },
      };
      await this.simulateEmailSend(emailData);
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

  private validateEmailData(data: EmailJobData): void {
    if (!data.to || !data.subject) {
      throw new Error('Email recipient and subject are required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.to)) {
      throw new Error(`Invalid email address: ${data.to}`);
    }
  }

  private async simulateEmailSend(data: EmailJobData): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // In production, this would call an actual email service
    this.logger.debug(`Email sent successfully to ${data.to}`);
  }
}
