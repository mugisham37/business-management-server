import { BaseDomainEvent } from '../../../core/events/base-event';

export class UserDeletedEvent extends BaseDomainEvent {
  constructor(
    userId: string,
    public readonly email: string,
    metadata?: Record<string, any>,
  ) {
    super(userId, metadata);
  }
}
