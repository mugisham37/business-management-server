# Events Module

The Events module provides a robust event-driven architecture using EventEmitter2 with support for:

- **Wildcard event matching** - Listen to multiple events with patterns like `user.*`
- **Event namespacing** - Organize events with dot notation like `user.created`, `user.updated`
- **Async event handlers** - Support for asynchronous event processing
- **Error isolation** - Errors in one listener don't stop other listeners
- **Event logging** - Automatic logging of all events with timestamps
- **Event replay** - Replay events for debugging purposes
- **Metrics collection** - Track event counts, durations, and errors
- **Priority ordering** - Control listener execution order

## Installation

The module is already configured in the application. Just import `EventsModule` in your feature module:

```typescript
import { Module } from '@nestjs/common';
import { EventsModule } from '@/core/events';

@Module({
  imports: [EventsModule],
  // ...
})
export class YourFeatureModule {}
```

## Usage

### 1. Creating Domain Events

Extend `BaseDomainEvent` to create your custom events:

```typescript
import { BaseDomainEvent } from '@/core/events';

export class UserCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string,
  ) {
    super(userId, { email, name });
  }
}
```

### 2. Publishing Events

Use `EventBusService` to publish events:

```typescript
import { Injectable } from '@nestjs/common';
import { EventBusService } from '@/core/events';
import { UserCreatedEvent } from './events/user-created.event';

@Injectable()
export class UserService {
  constructor(private readonly eventBus: EventBusService) {}

  async createUser(email: string, name: string): Promise<User> {
    const user = await this.userRepository.create({ email, name });
    
    // Publish event
    await this.eventBus.publish(
      new UserCreatedEvent(user.id, user.email, user.name)
    );
    
    return user;
  }
}
```

### 3. Listening to Events

Use the `@EventListener` decorator to register event handlers:

```typescript
import { Injectable } from '@nestjs/common';
import { EventListener } from '@/core/events';
import { UserCreatedEvent } from './events/user-created.event';

@Injectable()
export class EmailService {
  @EventListener('UserCreatedEvent')
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    await this.sendWelcomeEmail(event.email, event.name);
  }
}
```

### 4. Wildcard Event Listeners

Listen to multiple events with wildcard patterns:

```typescript
@Injectable()
export class AuditService {
  // Listen to all user events
  @EventListener('user.*')
  async onAnyUserEvent(event: BaseDomainEvent): Promise<void> {
    await this.logAuditEntry(event);
  }
  
  // Listen to all events
  @EventListener('*')
  async onAnyEvent(event: BaseDomainEvent): Promise<void> {
    console.log(`Event emitted: ${event.eventName}`);
  }
}
```

### 5. Event Listener Priority

Control the execution order of listeners:

```typescript
@Injectable()
export class NotificationService {
  // Higher priority executes first
  @EventListener('UserCreatedEvent', { priority: 10 })
  async sendNotification(event: UserCreatedEvent): Promise<void> {
    // This runs first
  }
  
  @EventListener('UserCreatedEvent', { priority: 5 })
  async logNotification(event: UserCreatedEvent): Promise<void> {
    // This runs second
  }
}
```

### 6. One-Time Listeners

Register listeners that execute only once:

```typescript
import { EventListenerOnce } from '@/core/events';

@Injectable()
export class SetupService {
  @EventListenerOnce('ApplicationStarted')
  async onFirstStart(event: ApplicationStartedEvent): Promise<void> {
    // This only runs once
    await this.performInitialSetup();
  }
}
```

### 7. Event Logging and Metrics

Access event logs and metrics:

```typescript
import { Injectable } from '@nestjs/common';
import { EventLoggerService } from '@/core/events';

@Injectable()
export class MonitoringService {
  constructor(private readonly eventLogger: EventLoggerService) {}

  getEventMetrics() {
    // Get all metrics
    const allMetrics = this.eventLogger.getMetrics();
    
    // Get metrics for specific event
    const userMetrics = this.eventLogger.getMetrics('UserCreatedEvent');
    
    return { allMetrics, userMetrics };
  }

  getEventHistory() {
    // Get all events
    const allEvents = this.eventLogger.getEventLog();
    
    // Get filtered events
    const userEvents = this.eventLogger.getEventLog({
      eventName: 'UserCreatedEvent',
      startDate: new Date('2024-01-01'),
    });
    
    return { allEvents, userEvents };
  }
}
```

### 8. Event Replay

Replay events for debugging:

```typescript
import { Injectable } from '@nestjs/common';
import { EventLoggerService, EventBusService } from '@/core/events';

@Injectable()
export class DebugService {
  constructor(
    private readonly eventLogger: EventLoggerService,
    private readonly eventBus: EventBusService,
  ) {}

  async replayUserEvents() {
    // Get events to replay
    const events = this.eventLogger.replayEvents({
      eventName: 'UserCreatedEvent',
    });
    
    // Re-emit each event
    for (const event of events) {
      await this.eventBus.publish(event);
    }
  }
}
```

## Error Handling

Event listeners are automatically wrapped with error handling. If a listener throws an error:

1. The error is logged with full context
2. Other listeners continue to execute
3. Metrics are updated with error count
4. The error does NOT propagate to the event publisher

```typescript
@Injectable()
export class RiskyService {
  @EventListener('UserCreatedEvent')
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    // If this throws an error, other listeners still execute
    throw new Error('Something went wrong');
  }
}
```

## Event Namespacing

Use dot notation to organize events hierarchically:

```typescript
// Domain events
export class UserCreatedEvent extends BaseDomainEvent {}  // 'UserCreatedEvent'
export class UserUpdatedEvent extends BaseDomainEvent {}  // 'UserUpdatedEvent'
export class UserDeletedEvent extends BaseDomainEvent {}  // 'UserDeletedEvent'

// Listen to specific event
@EventListener('UserCreatedEvent')
async onUserCreated(event: UserCreatedEvent) {}

// Listen to all user events with wildcard
@EventListener('User*')
async onAnyUserEvent(event: BaseDomainEvent) {}
```

## Best Practices

1. **Use descriptive event names** - Event names should clearly describe what happened
2. **Keep events immutable** - Events should be read-only data structures
3. **Include relevant context** - Add all necessary data to the event
4. **Don't modify state in listeners** - Listeners should be side-effects only
5. **Handle errors gracefully** - Don't let listener errors break your application
6. **Use async handlers** - Most event handlers should be async
7. **Avoid circular dependencies** - Don't emit events that trigger the same event
8. **Log important events** - Use the event logger for audit trails

## Architecture

```
┌─────────────────┐
│  Event Publisher│
│   (Service)     │
└────────┬────────┘
         │
         │ publish()
         ▼
┌─────────────────┐
│   EventBus      │
│   Service       │
└────────┬────────┘
         │
         │ emitAsync()
         ▼
┌─────────────────┐
│  EventEmitter2  │
│   (NestJS)      │
└────────┬────────┘
         │
         │ notify listeners
         ▼
┌─────────────────┐
│ Event Listeners │
│  (@EventListener)│
└─────────────────┘
```

## Testing

Test event emission and handling:

```typescript
import { Test } from '@nestjs/testing';
import { EventsModule, EventBusService } from '@/core/events';

describe('UserService', () => {
  let eventBus: EventBusService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [EventsModule],
      providers: [UserService],
    }).compile();
    
    eventBus = module.get(EventBusService);
  });
  
  it('should emit UserCreatedEvent when user is created', async () => {
    const spy = jest.spyOn(eventBus, 'publish');
    
    await userService.createUser('test@example.com', 'Test User');
    
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'UserCreatedEvent',
        email: 'test@example.com',
      })
    );
  });
});
```

## API Reference

### BaseDomainEvent

Base class for all domain events.

**Properties:**
- `eventId: string` - Unique identifier for the event
- `eventName: string` - Name of the event (class name)
- `occurredAt: Date` - When the event occurred
- `aggregateId: string` - ID of the related entity
- `metadata: Record<string, any>` - Additional event data

### EventBusService

Service for publishing and subscribing to domain events.

**Methods:**
- `publish(event: BaseDomainEvent): Promise<void>` - Publish an event
- `subscribe(eventName: string, handler: EventHandler): void` - Subscribe to an event
- `unsubscribe(eventName: string, handler: EventHandler): void` - Unsubscribe from an event
- `subscribeOnce(eventName: string, handler: EventHandler): void` - Subscribe once
- `getSubscriberCount(eventName: string): number` - Get subscriber count

### EventLoggerService

Service for logging and monitoring events.

**Methods:**
- `logEvent(event: BaseDomainEvent, correlationId?: string): void` - Log an event
- `getMetrics(eventName?: string): EventMetrics | EventMetrics[]` - Get metrics
- `getEventLog(filter?: EventLogFilter): EventLogEntry[]` - Get event log
- `replayEvents(filter?: EventLogFilter): BaseDomainEvent[]` - Replay events
- `getSummary(): EventSummary` - Get summary statistics
- `clear(): void` - Clear logs and metrics

### @EventListener Decorator

Decorator for registering event listeners.

**Parameters:**
- `event: string` - Event name or pattern (supports wildcards)
- `options?: EventListenerOptions` - Optional configuration
  - `priority?: number` - Listener priority (higher = first)
  - `prependListener?: boolean` - Prepend to listener list
  - `once?: boolean` - One-time listener
  - `suppressErrors?: boolean` - Suppress errors

## Related Modules

- **Cache Module** - Uses events for cache invalidation
- **Queue Module** - Can be triggered by events
- **Logging Module** - Integrates with event logging
- **Database Module** - Emits events for entity changes
