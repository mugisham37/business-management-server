import { Injectable, Logger } from '@nestjs/common';
import { EventLoggerService } from './event-logger.service';

/**
 * Interceptor for event listeners that provides:
 * - Error isolation (errors in one listener don't stop others)
 * - Execution time tracking
 * - Automatic logging
 */
@Injectable()
export class EventListenerInterceptor {
  private readonly logger = new Logger(EventListenerInterceptor.name);

  constructor(private readonly eventLogger: EventLoggerService) {}

  /**
   * Wrap an event listener to add error handling and metrics
   * @param listenerName Name of the listener
   * @param eventName Name of the event
   * @param listener The listener function to wrap
   * @returns Wrapped listener function
   */
  wrap<T = any>(
    listenerName: string,
    eventName: string,
    listener: (event: T) => void | Promise<void>,
  ): (event: T) => Promise<void> {
    return async (event: T): Promise<void> => {
      const startTime = Date.now();

      try {
        await listener(event);
        const duration = Date.now() - startTime;
        this.eventLogger.logListenerExecution(
          eventName,
          listenerName,
          duration,
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(
          `Error in event listener ${listenerName} for event ${eventName}`,
          error instanceof Error ? error.stack : String(error),
        );

        // Log the error but don't throw it to prevent stopping other listeners
        this.eventLogger.logListenerExecution(
          eventName,
          listenerName,
          duration,
          error instanceof Error ? error : new Error(String(error)),
        );

        // Don't re-throw the error to ensure other listeners continue
      }
    };
  }
}
