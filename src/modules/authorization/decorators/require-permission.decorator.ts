import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for required permissions
 */
export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Permission requirement interface
 */
export interface PermissionRequirement {
  module: string;
  action: string;
}

/**
 * Decorator to specify required permission for a resolver or controller method
 * 
 * @param module - Module name (e.g., 'INVENTORY', 'SALES')
 * @param action - Action name (e.g., 'CREATE', 'READ', 'UPDATE', 'DELETE')
 * 
 * @example
 * ```typescript
 * @RequirePermission('INVENTORY', 'CREATE')
 * @Mutation(() => Product)
 * async createProduct() { ... }
 * ```
 */
export const RequirePermission = (module: string, action: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, action } as PermissionRequirement);
