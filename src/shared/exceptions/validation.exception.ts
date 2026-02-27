import { BaseException } from './base.exception';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  constraints: Record<string, string>;
  value?: any;
}

/**
 * Exception for validation failures
 */
export class ValidationException extends BaseException {
  constructor(
    message: string,
    public readonly errors: ValidationError[],
  ) {
    super(message, 'VALIDATION_ERROR', 400, { errors });
  }
}
