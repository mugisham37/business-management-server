/**
 * Hierarchy levels in the organizational structure
 * Defines the three-tier hierarchy: Owner → Manager → Worker
 */
export enum HierarchyLevel {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  WORKER = 'WORKER',
}

/**
 * Hierarchy level numeric values for comparison
 * Higher values indicate higher hierarchy levels
 */
export const HIERARCHY_LEVEL_VALUES: Record<HierarchyLevel, number> = {
  [HierarchyLevel.OWNER]: 3,
  [HierarchyLevel.MANAGER]: 2,
  [HierarchyLevel.WORKER]: 1,
};
