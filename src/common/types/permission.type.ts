/**
 * Permission-related types
 */

/**
 * Permission set representing user's permissions
 */
export interface PermissionSet {
  modules: Map<string, string[]>; // module -> actions[]
  fingerprint: string;
}

/**
 * Module permission for granting/revoking
 */
export interface ModulePermission {
  module: string;
  actions: string[];
}

/**
 * Validation result for permission delegation
 */
export interface ValidationResult {
  valid: boolean;
  missingPermissions: ModulePermission[];
  message?: string;
}

/**
 * Resource scope for authorization checks
 */
export interface ResourceScope {
  branchId?: string;
  departmentId?: string;
}
