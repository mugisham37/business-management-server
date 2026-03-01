import { BadRequestException } from '@nestjs/common';

/**
 * Validation exceptions with field-specific information
 * 
 * Requirement 15.6, 20.1, 20.2, 20.3
 */

/**
 * Field validation exception
 */
export class FieldValidationException extends BadRequestException {
  public readonly field: string;
  public readonly validationErrors: string[];

  constructor(field: string, errors: string[]) {
    super(`Validation failed for field '${field}': ${errors.join(', ')}`);
    this.field = field;
    this.validationErrors = errors;
    this.name = 'FieldValidationException';
  }
}

/**
 * Email format exception
 */
export class InvalidEmailFormatException extends FieldValidationException {
  constructor(email: string) {
    super('email', [`Invalid email format: ${email}`]);
    this.name = 'InvalidEmailFormatException';
  }
}

/**
 * Password strength exception
 */
export class WeakPasswordException extends FieldValidationException {
  constructor(requirements: string[]) {
    super('password', [
      'Password does not meet requirements:',
      ...requirements,
    ]);
    this.name = 'WeakPasswordException';
  }
}

/**
 * PIN format exception
 */
export class InvalidPINFormatException extends FieldValidationException {
  constructor() {
    super('pin', ['PIN must be 4-6 digits']);
    this.name = 'InvalidPINFormatException';
  }
}

/**
 * Code format exception
 */
export class InvalidCodeFormatException extends FieldValidationException {
  constructor(code: string) {
    super('code', [
      `Code '${code}' must be alphanumeric and 2-10 characters`,
    ]);
    this.name = 'InvalidCodeFormatException';
  }
}

/**
 * Duplicate code exception
 */
export class DuplicateCodeException extends BadRequestException {
  public readonly code: string;
  public readonly resourceType: string;

  constructor(resourceType: string, code: string) {
    super(`${resourceType} with code '${code}' already exists`);
    this.code = code;
    this.resourceType = resourceType;
    this.name = 'DuplicateCodeException';
  }
}

/**
 * Invalid module exception
 */
export class InvalidModuleException extends FieldValidationException {
  constructor(module: string, validModules: string[]) {
    super('module', [
      `Invalid module '${module}'. Valid modules: ${validModules.join(', ')}`,
    ]);
    this.name = 'InvalidModuleException';
  }
}

/**
 * Invalid action exception
 */
export class InvalidActionException extends FieldValidationException {
  constructor(action: string, module: string, validActions: string[]) {
    super('action', [
      `Invalid action '${action}' for module '${module}'. Valid actions: ${validActions.join(', ')}`,
    ]);
    this.name = 'InvalidActionException';
  }
}

/**
 * Missing required field exception
 */
export class MissingRequiredFieldException extends FieldValidationException {
  constructor(field: string) {
    super(field, [`Field '${field}' is required`]);
    this.name = 'MissingRequiredFieldException';
  }
}
