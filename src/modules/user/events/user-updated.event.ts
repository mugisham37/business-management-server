import { BaseDomainEvent } from '../../../core/events/base-event';

export class UserUpdatedEvent extends BaseDomainEvent {
  constructor(
    userId: string,
    public readonly changes: Partial<{
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
    }>,
    metadata?: Record<string, any>,
  ) {
    super(userId, metadata);
  }
}
