import { Injectable, Logger } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullService } from './bull.service';

@Injectable()
export class BullBoardService {
  private readonly logger = new Logger(BullBoardService.name);
  private serverAdapter: ExpressAdapter;

  constructor(private readonly bullService: BullService) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
    this.setupBullBoard();
  }

  private setupBullBoard(): void {
    const queues = this.bullService.getAllQueues();
    const bullAdapters = queues.map((queue) => new BullAdapter(queue));

    createBullBoard({
      queues: bullAdapters,
      serverAdapter: this.serverAdapter,
    });

    this.logger.log('Bull Board initialized at /admin/queues');
  }

  getRouter() {
    return this.serverAdapter.getRouter();
  }
}
