# Queue Module

The Queue Module provides a robust job queue system built on Bull and Redis for handling asynchronous background tasks.

## Features

- **Multiple Named Queues**: Email, Report, Notification, Invoice, Stock, Integration, Cleanup, and Dead Letter queues
- **Job Processors**: Pre-built processors for common tasks with retry strategies
- **Priority Levels**: Critical, High, Medium, Low, and Background priorities
- **Scheduled Jobs**: Support for cron-based recurring jobs
- **Dead Letter Queue**: Automatic handling of permanently failed jobs
- **Bull Board Dashboard**: Web UI for monitoring queues at `/admin/queues`
- **Job Management**: Pause, resume, retry, and remove jobs
- **Progress Tracking**: Real-time job progress updates

## Installation

The module is already configured. To use it in your application:

```typescript
import { QueueModule } from './core/queue';

@Module({
  imports: [
    QueueModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      enableBullBoard: true, // Enable Bull Board dashboard
    }),
  ],
})
export class AppModule {}
```

## Usage

### Adding Jobs

```typescript
import { BullService, QueueName, JobPriority } from './core/queue';

@Injectable()
export class UserService {
  constructor(private readonly bullService: BullService) {}

  async sendWelcomeEmail(email: string, name: string) {
    // Simple job
    await this.bullService.addJob(
      QueueName.EMAIL,
      'send-welcome',
      { email, name }
    );

    // Job with priority
    await this.bullService.addJobWithPriority(
      QueueName.EMAIL,
      'send-welcome',
      { email, name },
      JobPriority.HIGH
    );

    // Scheduled job (cron)
    await this.bullService.addScheduledJob(
      QueueName.CLEANUP,
      'cleanup-old-data',
      {},
      '0 2 * * *' // Every day at 2 AM
    );
  }
}
```

### Creating Custom Processors

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { BaseProcessor, QueueName } from './core/queue';

@Processor(QueueName.INVOICE)
export class InvoiceProcessor extends BaseProcessor {
  constructor() {
    super(InvoiceProcessor.name);
  }

  @Process('generate-invoice')
  async handleGenerateInvoice(job: Job<{ orderId: string }>): Promise<void> {
    await this.handleJob(job, async (data, job) => {
      // Update progress
      await this.updateProgress(job, 25);
      
      // Your business logic here
      const invoice = await this.generateInvoice(data.orderId);
      
      await this.updateProgress(job, 100);
    });
  }

  private async generateInvoice(orderId: string) {
    // Implementation
  }
}
```

### Queue Management

```typescript
// Get queue status
const status = await this.bullService.getQueueStatus(QueueName.EMAIL);
console.log(status);
// { name: 'email', waiting: 5, active: 2, completed: 100, failed: 3, delayed: 0, paused: false }

// Pause a queue
await this.bullService.pauseQueue(QueueName.EMAIL);

// Resume a queue
await this.bullService.resumeQueue(QueueName.EMAIL);

// Get all queue statuses
const allStatuses = await this.bullService.getAllQueueStatuses();

// Retry a failed job
await this.bullService.retryJob(QueueName.EMAIL, 'job-id');

// Clean completed jobs older than 1 hour
await this.bullService.cleanCompletedJobs(QueueName.EMAIL, 3600000);
```

### Dead Letter Queue

Failed jobs that exhaust all retry attempts are automatically moved to the dead letter queue:

```typescript
// Get all dead letter jobs
const dlqJobs = await this.bullService.getDeadLetterJobs();

// Retry a job from dead letter queue
await this.bullService.retryFromDeadLetterQueue('dlq-job-id');
```

## Job Options

```typescript
import { createJobOptions, createScheduledJobOptions, JobPriority } from './core/queue';

// Job with custom options
const options = createJobOptions(JobPriority.HIGH, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3000,
  },
  removeOnComplete: true,
  removeOnFail: false,
});

await this.bullService.addJob(QueueName.EMAIL, 'send-email', data, options);

// Scheduled job with options
const scheduledOptions = createScheduledJobOptions(
  '0 */6 * * *', // Every 6 hours
  JobPriority.MEDIUM
);

await this.bullService.addJob(QueueName.REPORT, 'generate-report', data, scheduledOptions);
```

## Priority Levels

- **CRITICAL (1)**: 5 retry attempts - For critical operations that must succeed
- **HIGH (2)**: 4 retry attempts - For important operations
- **MEDIUM (3)**: 3 retry attempts - Default priority
- **LOW (4)**: 2 retry attempts - For non-urgent operations
- **BACKGROUND (5)**: 1 retry attempt - For background cleanup tasks

## Bull Board Dashboard

Access the Bull Board dashboard at `http://localhost:3000/admin/queues` to:
- Monitor queue status in real-time
- View job details and progress
- Retry failed jobs
- Clean up old jobs
- Pause/resume queues

## Best Practices

1. **Use appropriate priorities**: Reserve CRITICAL for truly critical operations
2. **Set reasonable TTLs**: Use `removeOnComplete` to prevent Redis memory bloat
3. **Handle errors gracefully**: Use try-catch in processors and log errors
4. **Monitor the dead letter queue**: Regularly review and address failed jobs
5. **Use progress tracking**: Update job progress for long-running tasks
6. **Clean up old jobs**: Periodically clean completed and failed jobs

## Architecture

```
┌─────────────┐
│   Service   │
└──────┬──────┘
       │ addJob()
       ▼
┌─────────────┐
│ BullService │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│    Queue    │────▶│  Processor   │
└─────────────┘     └──────┬───────┘
       │                   │
       │                   ▼
       │            ┌──────────────┐
       │            │ Job Handler  │
       │            └──────┬───────┘
       │                   │
       │                   │ On Failure
       │                   ▼
       │            ┌──────────────┐
       └───────────▶│ Dead Letter  │
                    │    Queue     │
                    └──────────────┘
```

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

## Testing

```typescript
describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let bullService: BullService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [QueueModule.forRoot({ redis: { host: 'localhost', port: 6379 } })],
      providers: [EmailProcessor],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    bullService = module.get<BullService>(BullService);
  });

  it('should process email job', async () => {
    const job = await bullService.addJob(QueueName.EMAIL, 'send-email', {
      to: 'test@example.com',
      subject: 'Test',
      template: 'test',
    });

    // Wait for job to complete
    await job.finished();
    
    expect(job.finishedOn).toBeDefined();
  });
});
```
