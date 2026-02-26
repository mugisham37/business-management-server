import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Service wrapper around EventEmitter2 for domain event emission.
 * Provides a clean interface for emitting and listening to events.
 */
@Injectable()
export class EventEmitterService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit an event synchronously
   * @param event Event name or pattern
   * @param payload Event payload
   * @returns true if the event had listeners, false otherwise
   */
  emit(event: string, payload: any): boolean {
    return this.eventEmitter.emit(event, payload);
  }

  /**
   * Emit an event asynchronously
   * @param event Event name or pattern
   * @param payload Event payload
   * @returns Promise that resolves with array of listener results
   */
  async emitAsync(event: string, payload: any): Promise<any[]> {
    return this.eventEmitter.emitAsync(event, payload);
  }

  /**
   * Register an event listener
   * @param event Event name or pattern
   * @param listener Listener function
   */
  on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Register a one-time event listener
   * @param event Event name or pattern
   * @param listener Listener function
   */
  once(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.once(event, listener);
    return this;
  }

  /**
   * Remove an event listener
   * @param event Event name or pattern
   * @param listener Listener function
   */
  removeListener(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.removeListener(event, listener);
    return this;
  }

  /**
   * Remove all listeners for an event
   * @param event Optional event name or pattern
   */
  removeAllListeners(event?: string): this {
    this.eventEmitter.removeAllListeners(event);
    return this;
  }

  /**
   * Get the number of listeners for an event
   * @param event Event name or pattern
   */
  listenerCount(event: string): number {
    return this.eventEmitter.listenerCount(event);
  }

  /**
   * Get all listeners for an event
   * @param event Event name or pattern
   */
  listeners(event: string): ((...args: any[]) => void)[] {
    return this.eventEmitter.listeners(event) as ((...args: any[]) => void)[];
  }
}
