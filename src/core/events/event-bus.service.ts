import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseDomainEvent } from './base-event';
import { EventLoggerService } from './event-logger.service';

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (event: T) => void | Promise<void>;

/**
 * Event Bus service for cross-module communication.
 * Provides a higher-level abstraction over EventEmitter2 specifically for domain events.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventLogger: EventLoggerService,
  ) {}

  /**
   * Publish a domain event to all subscribers
   * @param event Domain event to publish
   */
  async publish(event: BaseDomainEvent): Promise<void> {
    try {
      this.logger.debug(
        `Publishing event: ${event.eventName} (${event.eventId})`,
      );

      // Log the event
      this.eventLogger.logEvent(event);

      // Emit the event asynchronously
      await this.eventEmitter.emitAsync(event.eventName, event);

      this.logger.debug(
        `Event published successfully: ${event.eventName} (${event.eventId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error publishing event: ${event.eventName} (${event.eventId})`,
        error,
      );
      throw error;
    }
  }

  /**
   * Subscribe to a domain event
   * @param eventName Name of the event to subscribe to
   * @param handler Handler function to execute when event is received
   */
  subscribe<T = any>(eventName: string, handler: EventHandler<T>): void {
    this.logger.debug(`Subscribing to event: ${eventName}`);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.eventEmitter.on(eventName, handler);
  }

  /**
   * Unsubscribe from a domain event
   * @param eventName Name of the event to unsubscribe from
   * @param handler Handler function to remove
   */
  unsubscribe<T = any>(eventName: string, handler: EventHandler<T>): void {
    this.logger.debug(`Unsubscribing from event: ${eventName}`);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.eventEmitter.removeListener(eventName, handler);
  }

  /**
   * Subscribe to an event with a one-time handler
   * @param eventName Name of the event to subscribe to
   * @param handler Handler function to execute once when event is received
   */
  subscribeOnce<T = any>(eventName: string, handler: EventHandler<T>): void {
    this.logger.debug(`Subscribing once to event: ${eventName}`);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.eventEmitter.once(eventName, handler);
  }

  /**
   * Get the number of subscribers for an event
   * @param eventName Name of the event
   */
  getSubscriberCount(eventName: string): number {
    return this.eventEmitter.listenerCount(eventName);
  }
}
