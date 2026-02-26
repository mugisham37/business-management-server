import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitterService } from './event-emitter.service';
import { EventBusService } from './event-bus.service';
import { EventLoggerService } from './event-logger.service';
import { EventListenerInterceptor } from './event-listener.interceptor';

/**
 * Events module that configures EventEmitter2 and provides event services.
 * Enables wildcard support for flexible event pattern matching.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Enable wildcard support for event patterns (e.g., 'user.*')
      wildcard: true,
      // Use dot notation as delimiter for namespacing (e.g., 'user.created')
      delimiter: '.',
      // Create a new listener for each event
      newListener: false,
      // Remove listener warning
      removeListener: false,
      // Maximum number of listeners per event (0 = unlimited)
      maxListeners: 0,
      // Emit events synchronously
      verboseMemoryLeak: false,
      // Ignore errors in listeners (handled by individual listeners)
      ignoreErrors: false,
    }),
  ],
  providers: [
    EventEmitterService,
    EventBusService,
    EventLoggerService,
    EventListenerInterceptor,
  ],
  exports: [
    EventEmitterService,
    EventBusService,
    EventLoggerService,
    EventListenerInterceptor,
  ],
})
export class EventsModule {}
