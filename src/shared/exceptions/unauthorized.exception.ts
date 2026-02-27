import { BaseException } from './base.exception';

/**
 * Exception for authentication failures
 */
export class UnauthorizedException extends BaseException {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
