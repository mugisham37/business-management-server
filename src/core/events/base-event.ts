import { randomUUID } from 'crypto';

/**
 * Base class for all domain events in the system.
 * Provides common metadata fields that all events should have.
 */
export abstract class BaseDomainEvent {
  /**
   * Unique identifier for this event instance
   */
  readonly eventId: string;

  /**
   * Name of the event (derived from class name)
   */
  readonly eventName: string;

  /**
   * Timestamp when the event occurred
   */
  readonly occurredAt: Date;

  /**
   * ID of the aggregate/entity that this event relates to
   */
  readonly aggregateId: string;

  /**
   * Additional metadata for the event
   */
  readonly metadata: Record<string, any>;

  constructor(aggregateId: string, metadata?: Record<string, any>) {
    this.eventId = randomUUID();
    this.eventName = this.constructor.name;
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
    this.metadata = metadata || {};
  }
}
