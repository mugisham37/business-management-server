import { SetMetadata } from '@nestjs/common';

/**
 * Permissions Decorator
 * Used to specify required permissions for a route or resolver
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
