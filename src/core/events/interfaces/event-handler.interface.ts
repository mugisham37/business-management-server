/**
 * Interface for event handlers
 */
export interface IEventHandler<T = any> {
  /**
   * Handle the event
   * @param event The event to handle
   */
  handle(event: T): void | Promise<void>;
}
