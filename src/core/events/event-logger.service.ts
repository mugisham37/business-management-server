import { Injectable, Logger } from '@nestjs/common';
import { BaseDomainEvent } from './base-event';

/**
 * Event log entry structure
 */
export interface EventLogEntry {
  eventId: string;
  eventName: string;
  occurredAt: Date;
  aggregateId: string;
  payload: any;
  metadata: Record<string, any>;
  correlationId?: string;
}

/**
 * Event metrics structure
 */
export interface EventMetrics {
  eventName: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  lastEmittedAt?: Date;
  errors: number;
}

/**
 * Service for logging and monitoring domain events.
 * Provides event replay capability and metrics collection.
 */
@Injectable()
export class EventLoggerService {
  private readonly logger = new Logger(EventLoggerService.name);
  private readonly eventLog: EventLogEntry[] = [];
  private readonly metrics = new Map<string, EventMetrics>();
  private readonly maxLogSize = 10000; // Maximum number of events to keep in memory

  /**
   * Log an emitted event
   * @param event The domain event to log
   * @param correlationId Optional correlation ID for request tracing
   */
  logEvent(event: BaseDomainEvent, correlationId?: string): void {
    const logEntry: EventLogEntry = {
      eventId: event.eventId,
      eventName: event.eventName,
      occurredAt: event.occurredAt,
      aggregateId: event.aggregateId,
      payload: event,
      metadata: event.metadata,
      correlationId,
    };

    // Add to event log
    this.eventLog.push(logEntry);

    // Trim log if it exceeds max size
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Log to console
    this.logger.log({
      message: `Event emitted: ${event.eventName}`,
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
      correlationId,
      metadata: event.metadata,
    });
  }

  /**
   * Log an event listener execution
   * @param eventName Name of the event
   * @param listenerName Name of the listener
   * @param duration Execution duration in milliseconds
   * @param error Optional error if listener failed
   */
  logListenerExecution(
    eventName: string,
    listenerName: string,
    duration: number,
    error?: Error,
  ): void {
    if (error) {
      this.logger.error({
        message: `Event listener failed: ${listenerName}`,
        eventName,
        listenerName,
        duration,
        error: error.message,
        stack: error.stack,
      });

      // Update error count in metrics
      this.updateMetrics(eventName, duration, true);
    } else {
      this.logger.debug({
        message: `Event listener executed: ${listenerName}`,
        eventName,
        listenerName,
        duration,
      });

      // Update metrics
      this.updateMetrics(eventName, duration, false);
    }
  }

  /**
   * Update metrics for an event
   * @param eventName Name of the event
   * @param duration Execution duration
   * @param isError Whether this was an error
   */
  private updateMetrics(
    eventName: string,
    duration: number,
    isError: boolean,
  ): void {
    const existing = this.metrics.get(eventName);

    if (existing) {
      existing.count++;
      existing.totalDuration += duration;
      existing.averageDuration = existing.totalDuration / existing.count;
      existing.lastEmittedAt = new Date();
      if (isError) {
        existing.errors++;
      }
    } else {
      this.metrics.set(eventName, {
        eventName,
        count: 1,
        totalDuration: duration,
        averageDuration: duration,
        lastEmittedAt: new Date(),
        errors: isError ? 1 : 0,
      });
    }
  }

  /**
   * Get event metrics for a specific event or all events
   * @param eventName Optional event name to filter by
   * @returns Event metrics
   */
  getMetrics(eventName?: string): EventMetrics | EventMetrics[] {
    if (eventName) {
      return (
        this.metrics.get(eventName) || {
          eventName,
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          errors: 0,
        }
      );
    }

    return Array.from(this.metrics.values());
  }

  /**
   * Get event log entries
   * @param filter Optional filter criteria
   * @returns Array of event log entries
   */
  getEventLog(filter?: {
    eventName?: string;
    aggregateId?: string;
    startDate?: Date;
    endDate?: Date;
  }): EventLogEntry[] {
    let filtered = [...this.eventLog];

    if (filter) {
      if (filter.eventName) {
        filtered = filtered.filter((e) => e.eventName === filter.eventName);
      }
      if (filter.aggregateId) {
        filtered = filtered.filter((e) => e.aggregateId === filter.aggregateId);
      }
      if (filter.startDate) {
        filtered = filtered.filter((e) => e.occurredAt >= filter.startDate!);
      }
      if (filter.endDate) {
        filtered = filtered.filter((e) => e.occurredAt <= filter.endDate!);
      }
    }

    return filtered;
  }

  /**
   * Replay events for debugging purposes
   * @param filter Optional filter criteria
   * @returns Array of events that can be re-emitted
   */
  replayEvents(filter?: {
    eventName?: string;
    aggregateId?: string;
    startDate?: Date;
    endDate?: Date;
  }): BaseDomainEvent[] {
    const logEntries = this.getEventLog(filter);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return logEntries.map((entry) => entry.payload);
  }

  /**
   * Clear event log and metrics
   */
  clear(): void {
    this.eventLog.length = 0;
    this.metrics.clear();
    this.logger.log('Event log and metrics cleared');
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEvents: number;
    uniqueEventTypes: number;
    totalErrors: number;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);

    return {
      totalEvents: this.eventLog.length,
      uniqueEventTypes: this.metrics.size,
      totalErrors,
      oldestEvent: this.eventLog[0]?.occurredAt,
      newestEvent: this.eventLog[this.eventLog.length - 1]?.occurredAt,
    };
  }
}
