import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { MODULE_REGISTRY, isValidModule, isValidAction } from '../../common/constants/module-registry.constant';
import { HierarchyLevel } from '../types/hierarchy-level.enum';

/**
 * Validator for module registry
 * Requirement 20.5: Validates that module exists in MODULE_REGISTRY
 */
@ValidatorConstraint({ name: 'isValidModuleName', async: false })
export class IsValidModuleNameConstraint implements ValidatorConstraintInterface {
  validate(module: string, args: ValidationArguments): boolean {
    return isValidModule(module);
  }

  defaultMessage(args: ValidationArguments): string {
    const validModules = Object.keys(MODULE_REGISTRY).join(', ');
    return `Module must be one of: ${validModules}`;
  }
}

/**
 * Decorator for module name validation
 * Usage: @IsValidModuleName()
 */
export function IsValidModuleName(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidModuleNameConstraint,
    });
  };
}

/**
 * Validator for module actions
 * Requirement 20.5: Validates that actions are valid for the specified module
 */
@ValidatorConstraint({ name: 'isValidModuleAction', async: false })
export class IsValidModuleActionConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const object = args.object as any;
    const module = object.module;

    // If module is not set or invalid, skip this validation
    // (module validation should be handled separately)
    if (!module || !isValidModule(module)) {
      return true;
    }

    // Validate that all actions are valid for the module
    if (Array.isArray(value)) {
      return value.every((action) => isValidAction(module, action));
    }

    // Single action validation
    if (typeof value === 'string') {
      return isValidAction(module, value);
    }

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as any;
    const module = object.module;
    
    if (module && isValidModule(module)) {
      const validActions = MODULE_REGISTRY[module].join(', ');
      return `Actions must be valid for module ${module}. Valid actions: ${validActions}`;
    }
    
    return 'Invalid actions for the specified module';
  }
}

/**
 * Decorator for module action validation
 * Usage: @IsValidModuleAction()
 */
export function IsValidModuleAction(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidModuleActionConstraint,
    });
  };
}

/**
 * Validator for hierarchy level
 * Requirement 20.4: Validates that hierarchy level is one of OWNER, MANAGER, WORKER
 */
@ValidatorConstraint({ name: 'isValidHierarchyLevel', async: false })
export class IsValidHierarchyLevelConstraint implements ValidatorConstraintInterface {
  validate(level: string, args: ValidationArguments): boolean {
    return Object.values(HierarchyLevel).includes(level as HierarchyLevel);
  }

  defaultMessage(args: ValidationArguments): string {
    const validLevels = Object.values(HierarchyLevel).join(', ');
    return `Hierarchy level must be one of: ${validLevels}`;
  }
}

/**
 * Decorator for hierarchy level validation
 * Usage: @IsValidHierarchyLevel()
 */
export function IsValidHierarchyLevel(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidHierarchyLevelConstraint,
    });
  };
}

/**
 * Validator for threshold value
 * Requirement 20.6: Validates that threshold value is positive
 */
@ValidatorConstraint({ name: 'isPositiveNumber', async: false })
export class IsPositiveNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    return typeof value === 'number' && value > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Value must be a positive number';
  }
}

/**
 * Decorator for positive number validation
 * Usage: @IsPositiveNumber()
 */
export function IsPositiveNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveNumberConstraint,
    });
  };
}

/**
 * Validator for non-negative number (priority can be 0)
 * Requirement 20.6: Validates that priority is non-negative
 */
@ValidatorConstraint({ name: 'isNonNegativeNumber', async: false })
export class IsNonNegativeNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    return typeof value === 'number' && value >= 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Value must be a non-negative number';
  }
}

/**
 * Decorator for non-negative number validation
 * Usage: @IsNonNegativeNumber()
 */
export function IsNonNegativeNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNonNegativeNumberConstraint,
    });
  };
}

/**
 * Combined validator for permission module and actions
 * Validates both module name and actions together
 */
export interface ModulePermission {
  module: string;
  actions: string[];
}

@ValidatorConstraint({ name: 'isValidPermission', async: false })
export class IsValidPermissionConstraint implements ValidatorConstraintInterface {
  validate(permission: ModulePermission, args: ValidationArguments): boolean {
    if (!permission || typeof permission !== 'object') {
      return false;
    }

    const { module, actions } = permission;

    // Validate module
    if (!isValidModule(module)) {
      return false;
    }

    // Validate actions
    if (!Array.isArray(actions) || actions.length === 0) {
      return false;
    }

    // Validate each action is valid for the module
    return actions.every((action) => isValidAction(module, action));
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Invalid permission: module must exist in registry and actions must be valid for that module';
  }
}

/**
 * Decorator for permission validation
 * Usage: @IsValidPermission()
 */
export function IsValidPermission(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPermissionConstraint,
    });
  };
}
