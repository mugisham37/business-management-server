import { BaseDomainEvent } from '../../../core/events/base-event';

export class UserCreatedEvent extends BaseDomainEvent {
  constructor(
    userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly tenantId: string,
    metadata?: Record<string, any>,
  ) {
    super(userId, metadata);
  }
}
