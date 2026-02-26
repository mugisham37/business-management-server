import { BaseDomainEvent } from '../base-event';

/**
 * Example event emitted when a user is created.
 * This demonstrates how to create custom domain events.
 */
export class UserCreatedEvent extends BaseDomainEvent {
  constructor(
    userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {
    super(userId, {
      email,
      firstName,
      lastName,
    });
  }

  /**
   * Get the full name of the user
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
