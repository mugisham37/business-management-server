/**
 * Permission seed data
 * Defines the base permissions for the system
 */

export interface PermissionSeedData {
  name: string;
  resource: string;
  action: string;
  description: string;
}

export const permissionsSeedData: PermissionSeedData[] = [
  // User permissions
  {
    name: 'user:create',
    resource: 'user',
    action: 'create',
    description: 'Create new users',
  },
  {
    name: 'user:read',
    resource: 'user',
    action: 'read',
    description: 'View user information',
  },
  {
    name: 'user:update',
    resource: 'user',
    action: 'update',
    description: 'Update user information',
  },
  {
    name: 'user:delete',
    resource: 'user',
    action: 'delete',
    description: 'Delete users',
  },

  // Role permissions
  {
    name: 'role:create',
    resource: 'role',
    action: 'create',
    description: 'Create new roles',
  },
  {
    name: 'role:read',
    resource: 'role',
    action: 'read',
    description: 'View role information',
  },
  {
    name: 'role:update',
    resource: 'role',
    action: 'update',
    description: 'Update role information',
  },
  {
    name: 'role:delete',
    resource: 'role',
    action: 'delete',
    description: 'Delete roles',
  },

  // Permission permissions
  {
    name: 'permission:create',
    resource: 'permission',
    action: 'create',
    description: 'Create new permissions',
  },
  {
    name: 'permission:read',
    resource: 'permission',
    action: 'read',
    description: 'View permission information',
  },
  {
    name: 'permission:update',
    resource: 'permission',
    action: 'update',
    description: 'Update permission information',
  },
  {
    name: 'permission:delete',
    resource: 'permission',
    action: 'delete',
    description: 'Delete permissions',
  },

  // Tenant permissions
  {
    name: 'tenant:create',
    resource: 'tenant',
    action: 'create',
    description: 'Create new tenants',
  },
  {
    name: 'tenant:read',
    resource: 'tenant',
    action: 'read',
    description: 'View tenant information',
  },
  {
    name: 'tenant:update',
    resource: 'tenant',
    action: 'update',
    description: 'Update tenant information',
  },
  {
    name: 'tenant:delete',
    resource: 'tenant',
    action: 'delete',
    description: 'Delete tenants',
  },

  // Audit log permissions
  {
    name: 'audit:read',
    resource: 'audit',
    action: 'read',
    description: 'View audit logs',
  },

  // System config permissions
  {
    name: 'config:read',
    resource: 'config',
    action: 'read',
    description: 'View system configuration',
  },
  {
    name: 'config:update',
    resource: 'config',
    action: 'update',
    description: 'Update system configuration',
  },
];
