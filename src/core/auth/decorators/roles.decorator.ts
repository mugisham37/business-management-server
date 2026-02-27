import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for roles
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 * Specifies required roles for endpoint access
 * @param roles Required role names
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
