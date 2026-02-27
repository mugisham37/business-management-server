import { BaseException } from './base.exception';

/**
 * Exception for resource not found errors
 */
export class NotFoundException extends BaseException {
  constructor(resource: string, id: string) {
    super(
      `${resource} with id ${id} not found`,
      'NOT_FOUND',
      404,
      { resource, id },
    );
  }
}
