import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * RequirePermissions Decorator
 * Specifies required permissions for endpoint access
 * @param permissions Required permission names
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
