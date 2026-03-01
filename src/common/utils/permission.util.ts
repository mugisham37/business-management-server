import { createHash } from 'crypto';
import { PermissionSet, ModulePermission } from '../types/permission.type';

/**
 * Calculate permission fingerprint using SHA-256
 * Used for detecting permission changes in JWT tokens
 */
export function calculatePermissionFingerprint(permissions: ModulePermission[]): string {
  // Sort modules and actions for consistent hashing
  const sorted = permissions
    .map((p) => ({
      module: p.module,
      actions: [...p.actions].sort(),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));

  const permissionString = JSON.stringify(sorted);
  return createHash('sha256').update(permissionString).digest('hex');
}

/**
 * Convert permission array to PermissionSet
 */
export function toPermissionSet(permissions: ModulePermission[]): PermissionSet {
  const modules = new Map<string, string[]>();

  for (const permission of permissions) {
    modules.set(permission.module, permission.actions);
  }

  return {
    modules,
    fingerprint: calculatePermissionFingerprint(permissions),
  };
}

/**
 * Convert PermissionSet to permission array
 */
export function fromPermissionSet(permissionSet: PermissionSet): ModulePermission[] {
  const permissions: ModulePermission[] = [];

  permissionSet.modules.forEach((actions: string[], module: string) => {
    permissions.push({ module, actions });
  });

  return permissions;
}

/**
 * Check if a permission set contains a specific permission
 */
export function hasPermission(
  permissionSet: PermissionSet,
  module: string,
  action: string,
): boolean {
  const actions = permissionSet.modules.get(module);
  return actions ? actions.includes(action) : false;
}

/**
 * Check if a permission set contains all specified permissions
 */
export function hasAllPermissions(
  permissionSet: PermissionSet,
  requiredPermissions: ModulePermission[],
): boolean {
  for (const required of requiredPermissions) {
    const actions = permissionSet.modules.get(required.module);
    if (!actions) {
      return false;
    }

    for (const action of required.actions) {
      if (!actions.includes(action)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get missing permissions from a permission set
 */
export function getMissingPermissions(
  permissionSet: PermissionSet,
  requiredPermissions: ModulePermission[],
): ModulePermission[] {
  const missing: ModulePermission[] = [];

  for (const required of requiredPermissions) {
    const actions = permissionSet.modules.get(required.module);
    const missingActions: string[] = [];

    for (const action of required.actions) {
      if (!actions || !actions.includes(action)) {
        missingActions.push(action);
      }
    }

    if (missingActions.length > 0) {
      missing.push({
        module: required.module,
        actions: missingActions,
      });
    }
  }

  return missing;
}

/**
 * Merge multiple permission sets
 */
export function mergePermissionSets(...sets: PermissionSet[]): PermissionSet {
  const mergedModules = new Map<string, string[]>();

  for (const set of sets) {
    set.modules.forEach((actions: string[], module: string) => {
      const existing = mergedModules.get(module) || [];
      const uniqueActions = new Set([...existing, ...actions]);
      const combined = Array.from(uniqueActions);
      mergedModules.set(module, combined);
    });
  }

  const permissions = fromPermissionSet({ modules: mergedModules, fingerprint: '' });
  return toPermissionSet(permissions);
}
