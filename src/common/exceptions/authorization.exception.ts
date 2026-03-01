import { ForbiddenException } from '@nestjs/common';

/**
 * Authorization exception with layer information
 * 
 * Used to provide detailed information about which authorization layer failed
 * 
 * Requirement 15.6
 */
export class AuthorizationException extends ForbiddenException {
  public readonly layer: string;
  public readonly reason: string;

  constructor(layer: string, reason: string) {
    super(`Authorization failed at ${layer}: ${reason}`);
    this.layer = layer;
    this.reason = reason;
    this.name = 'AuthorizationException';
  }
}

/**
 * Hierarchy level exception
 * Thrown when user doesn't meet minimum hierarchy level requirement
 */
export class HierarchyLevelException extends AuthorizationException {
  constructor(required: string, actual: string) {
    super(
      'Layer 1: Hierarchy Level',
      `Required level: ${required}, actual level: ${actual}`,
    );
  }
}

/**
 * Module permission exception
 * Thrown when user lacks required module permission
 */
export class ModulePermissionException extends AuthorizationException {
  constructor(module: string, action: string) {
    super(
      'Layer 2: Module Permission',
      `Missing permission: ${module}.${action}`,
    );
  }
}

/**
 * Scope violation exception
 * Thrown when user attempts to access resource outside their scope
 */
export class ScopeViolationException extends AuthorizationException {
  constructor(resourceScope: string, userScope: string) {
    super(
      'Layer 3: Scope Check',
      `Resource scope (${resourceScope}) outside user scope (${userScope})`,
    );
  }
}

/**
 * Business rule exception
 * Thrown when transaction violates business rules
 */
export class BusinessRuleException extends AuthorizationException {
  public readonly requiresApproval: boolean;
  public readonly approverLevel?: string;

  constructor(
    reason: string,
    requiresApproval: boolean = false,
    approverLevel?: string,
  ) {
    super('Layer 4: Business Rules', reason);
    this.requiresApproval = requiresApproval;
    this.approverLevel = approverLevel;
  }
}

/**
 * Permission delegation exception
 * Thrown when user attempts to grant permissions they don't possess
 */
export class DelegationException extends ForbiddenException {
  public readonly missingPermissions: Array<{ module: string; actions: string[] }>;

  constructor(missingPermissions: Array<{ module: string; actions: string[] }>) {
    const permissionList = missingPermissions
      .map(p => `${p.module}: ${p.actions.join(', ')}`)
      .join('; ');
    
    super(`Cannot grant permissions you don't possess: ${permissionList}`);
    this.missingPermissions = missingPermissions;
    this.name = 'DelegationException';
  }
}
