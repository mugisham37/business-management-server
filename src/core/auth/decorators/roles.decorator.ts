import { SetMetadata } from '@nestjs/common';

/**
 * Roles Decorator
 * Used to specify required roles for a route or resolver
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
