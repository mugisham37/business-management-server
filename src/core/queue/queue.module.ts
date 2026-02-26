import { Module, DynamicModule, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullService } from './bull.service';
import { BullBoardService } from './bull-board.service';
import { QueueName } from './interfaces';

export interface QueueModuleOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  enableBullBoard?: boolean;
}

@Global()
@Module({})
export class QueueModule {
  static forRoot(options: QueueModuleOptions): DynamicModule {
    const providers: any[] = [
      {
        provide: BullService,
        useFactory: () => {
          const service = new BullService(options);
          // Initialize all queues
          Object.values(QueueName).forEach((queueName) => {
            service.initializeQueue(queueName as QueueName);
          });
          return service;
        },
      },
    ];

    const exports: any[] = [BullService, BullModule];

    // Add Bull Board if enabled
    if (options.enableBullBoard !== false) {
      providers.push({
        provide: BullBoardService,
        useFactory: (bullService: BullService) => {
          return new BullBoardService(bullService);
        },
        inject: [BullService],
      });
      exports.push(BullBoardService);
    }

    return {
      module: QueueModule,
      imports: [
        BullModule.forRoot({
          redis: {
            host: options.redis.host,
            port: options.redis.port,
            password: options.redis.password,
          },
        }),
        // Register all named queues
        BullModule.registerQueue(
          { name: QueueName.EMAIL },
          { name: QueueName.REPORT },
          { name: QueueName.NOTIFICATION },
          { name: QueueName.INVOICE },
          { name: QueueName.STOCK },
          { name: QueueName.INTEGRATION },
          { name: QueueName.CLEANUP },
          { name: QueueName.DEAD_LETTER },
        ),
      ],
      providers,
      exports,
    };
  }
}
