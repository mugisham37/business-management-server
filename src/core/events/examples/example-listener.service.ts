import { Injectable, Logger } from '@nestjs/common';
import { EventListener } from '../decorators';
import { UserCreatedEvent } from './user-created.event';

/**
 * Example service demonstrating how to listen to events.
 * This would typically be in a feature module, not in the core events module.
 */
@Injectable()
export class ExampleListenerService {
  private readonly logger = new Logger(ExampleListenerService.name);

  /**
   * Listen to UserCreatedEvent with high priority
   */
  @EventListener('UserCreatedEvent', { priority: 10 })
  async onUserCreatedHighPriority(event: UserCreatedEvent): Promise<void> {
    this.logger.log(
      `[High Priority] User created: ${event.fullName} (${event.email})`,
    );
    // This executes first due to higher priority
  }

  /**
   * Listen to UserCreatedEvent with normal priority
   */
  @EventListener('UserCreatedEvent')
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`User created: ${event.fullName} (${event.email})`);
    // This executes after high priority listeners
  }

  /**
   * Listen to all User* events using wildcard
   */
  @EventListener('User*')
  async onAnyUserEvent(event: UserCreatedEvent): Promise<void> {
    this.logger.log(`User event received: ${event.eventName}`);
  }
}
