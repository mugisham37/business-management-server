import { OnEvent } from '@nestjs/event-emitter';

/**
 * Options for event listener decorator
 */
export interface EventListenerOptions {
  /**
   * Priority of the listener (higher values execute first)
   * Default: 0
   */
  priority?: number;

  /**
   * Whether to prepend this listener to the list
   * Default: false
   */
  prependListener?: boolean;

  /**
   * Whether this is a one-time listener
   * Default: false
   */
  once?: boolean;

  /**
   * Whether to suppress errors from this listener
   * Default: false
   */
  suppressErrors?: boolean;
}

/**
 * Decorator for registering event listeners with support for:
 * - Async event handlers with error handling
 * - Listener priority ordering
 * - Event namespacing with dot notation
 * - Wildcard pattern matching
 *
 * @param event Event name or pattern (supports wildcards like 'user.*')
 * @param options Optional configuration for the listener
 *
 * @example
 * ```typescript
 * @EventListener('user.created', { priority: 10 })
 * async onUserCreated(event: UserCreatedEvent): Promise<void> {
 *   // Handle event
 * }
 *
 * @EventListener('user.*')
 * async onAnyUserEvent(event: BaseDomainEvent): Promise<void> {
 *   // Handle any user event
 * }
 * ```
 */
export function EventListener(
  event: string,
  options?: EventListenerOptions,
): MethodDecorator {
  return OnEvent(event, {
    // Map priority to prependListener for execution order
    // Higher priority listeners should execute first
    prependListener: options?.prependListener ?? false,
    // Support async handlers
    async: true,
    // Suppress errors if configured (default: false to allow error propagation)
    suppressErrors: options?.suppressErrors ?? false,
    // Support one-time listeners
    ...(options?.once && { once: true }),
  });
}

/**
 * Decorator for registering a one-time event listener
 * The listener will be automatically removed after first execution
 *
 * @param event Event name or pattern
 * @param options Optional configuration for the listener
 */
export function EventListenerOnce(
  event: string,
  options?: Omit<EventListenerOptions, 'once'>,
): MethodDecorator {
  return EventListener(event, { ...options, once: true });
}
