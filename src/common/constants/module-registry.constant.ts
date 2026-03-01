/**
 * Module registry defining available modules and actions
 * This is the source of truth for all permission checks
 */
export const MODULE_REGISTRY = {
  INVENTORY: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'TRANSFER'],
  SALES: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'VOID'],
  PURCHASE: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'RECEIVE'],
  FINANCE: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'POST'],
  HR: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'],
  REPORTS: ['READ', 'EXPORT', 'SCHEDULE'],
  SETTINGS: ['READ', 'UPDATE'],
  USERS: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'GRANT_PERMISSIONS'],
} as const;

/**
 * Type for module names
 */
export type ModuleName = keyof typeof MODULE_REGISTRY;

/**
 * Type for actions in a specific module
 */
export type ModuleAction<T extends ModuleName> = (typeof MODULE_REGISTRY)[T][number];

/**
 * Get all modules
 */
export function getAllModules(): ModuleName[] {
  return Object.keys(MODULE_REGISTRY) as ModuleName[];
}

/**
 * Get all actions for a module
 */
export function getModuleActions(module: ModuleName): readonly string[] {
  return MODULE_REGISTRY[module];
}

/**
 * Check if a module exists
 */
export function isValidModule(module: string): module is ModuleName {
  return module in MODULE_REGISTRY;
}

/**
 * Check if an action is valid for a module
 */
export function isValidAction(module: ModuleName, action: string): boolean {
  return MODULE_REGISTRY[module].includes(action as any);
}

/**
 * Get all module-action combinations for owner initialization
 */
export function getAllPermissions(): Array<{ module: ModuleName; actions: string[] }> {
  return getAllModules().map((module) => ({
    module,
    actions: [...MODULE_REGISTRY[module]],
  }));
}
