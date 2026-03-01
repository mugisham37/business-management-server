import { PermissionMap } from '../types';

/**
 * Check if a user has a specific permission
 * @param permissions - User's permission map
 * @param module - Module name to check
 * @param action - Action to check within the module
 * @returns True if user has the permission, false otherwise
 */
export function hasPermission(
  permissions: PermissionMap,
  module: string,
  action: string,
): boolean {
  const moduleActions = permissions[module];
  if (!moduleActions) {
    return false;
  }
  return moduleActions.includes(action);
}

/**
 * Check if a user has all specified permissions
 * @param permissions - User's permission map
 * @param requiredPermissions - Array of required permissions in format "module:action"
 * @returns True if user has all permissions, false otherwise
 */
export function hasAllPermissions(
  permissions: PermissionMap,
  requiredPermissions: string[],
): boolean {
  for (const perm of requiredPermissions) {
    const [module, action] = perm.split(':');
    if (!hasPermission(permissions, module, action)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a user has any of the specified permissions
 * @param permissions - User's permission map
 * @param requiredPermissions - Array of required permissions in format "module:action"
 * @returns True if user has at least one permission, false otherwise
 */
export function hasAnyPermission(
  permissions: PermissionMap,
  requiredPermissions: string[],
): boolean {
  for (const perm of requiredPermissions) {
    const [module, action] = perm.split(':');
    if (hasPermission(permissions, module, action)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if one permission set is a subset of another (for Golden Rule validation)
 * @param subset - Permission map that should be a subset
 * @param superset - Permission map that should contain all permissions from subset
 * @returns True if subset is contained in superset, false otherwise
 */
export function isPermissionSubset(
  subset: PermissionMap,
  superset: PermissionMap,
): boolean {
  for (const [module, actions] of Object.entries(subset)) {
    const supersetActions = superset[module];
    if (!supersetActions) {
      return false;
    }

    for (const action of actions) {
      if (!supersetActions.includes(action)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Merge two permission maps, combining actions for overlapping modules
 * @param permissions1 - First permission map
 * @param permissions2 - Second permission map
 * @returns Merged permission map with unique actions per module
 */
export function mergePermissions(
  permissions1: PermissionMap,
  permissions2: PermissionMap,
): PermissionMap {
  const merged: PermissionMap = { ...permissions1 };

  for (const [module, actions] of Object.entries(permissions2)) {
    if (merged[module]) {
      // Merge actions and remove duplicates
      merged[module] = [...new Set([...merged[module], ...actions])];
    } else {
      merged[module] = [...actions];
    }
  }

  return merged;
}

/**
 * Get the difference between two permission maps (permissions in first but not in second)
 * @param permissions1 - First permission map
 * @param permissions2 - Second permission map
 * @returns Permission map containing only permissions in first but not in second
 */
export function getPermissionDifference(
  permissions1: PermissionMap,
  permissions2: PermissionMap,
): PermissionMap {
  const difference: PermissionMap = {};

  for (const [module, actions] of Object.entries(permissions1)) {
    const otherActions = permissions2[module] || [];
    const uniqueActions = actions.filter(
      (action) => !otherActions.includes(action),
    );

    if (uniqueActions.length > 0) {
      difference[module] = uniqueActions;
    }
  }

  return difference;
}

/**
 * Convert permission map to array of "module:action" strings
 * @param permissions - Permission map to convert
 * @returns Array of permission strings in format "module:action"
 */
export function permissionMapToArray(permissions: PermissionMap): string[] {
  const result: string[] = [];

  for (const [module, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      result.push(`${module}:${action}`);
    }
  }

  return result;
}

/**
 * Convert array of "module:action" strings to permission map
 * @param permissions - Array of permission strings in format "module:action"
 * @returns Permission map
 */
export function arrayToPermissionMap(permissions: string[]): PermissionMap {
  const map: PermissionMap = {};

  for (const perm of permissions) {
    const [module, action] = perm.split(':');
    if (!map[module]) {
      map[module] = [];
    }
    if (!map[module].includes(action)) {
      map[module].push(action);
    }
  }

  return map;
}
