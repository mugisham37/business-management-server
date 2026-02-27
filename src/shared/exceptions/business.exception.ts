import { BaseException } from './base.exception';

/**
 * Exception for business logic violations
 */
export class BusinessException extends BaseException {
  constructor(
    message: string,
    code: string,
    metadata?: Record<string, any>,
  ) {
    super(message, code, 400, metadata);
  }
}
