/**
 * Role-Permission mapping seed data
 * Defines which permissions are assigned to which roles
 */

export interface RolePermissionMapping {
  roleName: string;
  permissionNames: string[];
}

export const rolePermissionMappings: RolePermissionMapping[] = [
  {
    roleName: 'admin',
    permissionNames: [
      // All user permissions
      'user:create',
      'user:read',
      'user:update',
      'user:delete',
      // All role permissions
      'role:create',
      'role:read',
      'role:update',
      'role:delete',
      // All permission permissions
      'permission:create',
      'permission:read',
      'permission:update',
      'permission:delete',
      // All tenant permissions
      'tenant:create',
      'tenant:read',
      'tenant:update',
      'tenant:delete',
      // Audit permissions
      'audit:read',
      // Config permissions
      'config:read',
      'config:update',
    ],
  },
  {
    roleName: 'manager',
    permissionNames: [
      // User permissions (limited)
      'user:read',
      'user:update',
      // Role permissions (read only)
      'role:read',
      // Permission permissions (read only)
      'permission:read',
      // Tenant permissions (read only)
      'tenant:read',
      // Audit permissions
      'audit:read',
      // Config permissions (read only)
      'config:read',
    ],
  },
  {
    roleName: 'user',
    permissionNames: [
      // User permissions (read only, own profile)
      'user:read',
      // Config permissions (read only, public)
      'config:read',
    ],
  },
];
