import { BaseException } from './base.exception';

/**
 * Exception for authorization failures
 */
export class ForbiddenException extends BaseException {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
