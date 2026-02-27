import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError as ClassValidatorError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationException, ValidationError } from '../exceptions';

/**
 * Custom validation pipe with class-validator integration
 * Supports nested DTO validation and detailed error messages
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata): Promise<any> {
    // Skip validation for primitive types
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value);

    // Validate the object
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      forbidUnknownValues: true, // Throw error for unknown values
      validationError: {
        target: false, // Don't include target in error
        value: true, // Include value in error
      },
    });

    if (errors.length > 0) {
      const validationErrors = this.formatValidationErrors(errors);
      throw new ValidationException('Validation failed', validationErrors);
    }

    return object;
  }

  /**
   * Check if metatype should be validated
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Format validation errors into a structured format
   */
  private formatValidationErrors(
    errors: ClassValidatorError[],
    parentPath: string = '',
  ): ValidationError[] {
    const formattedErrors: ValidationError[] = [];

    for (const error of errors) {
      const fieldPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        formattedErrors.push(
          ...this.formatValidationErrors(error.children, fieldPath),
        );
      }

      // Handle direct validation errors
      if (error.constraints) {
        formattedErrors.push({
          field: fieldPath,
          constraints: error.constraints,
          value: error.value,
        });
      }
    }

    return formattedErrors;
  }
}
