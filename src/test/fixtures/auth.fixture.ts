/**
 * Auth Fixtures
 * Common authentication test scenarios
 */

import { PrismaClient } from '@prisma/client';
import { createTenant } from '../factories/tenant.factory';
import { createUser } from '../factories/user.factory';
import { createRole, createSystemRoles } from '../factories/role.factory';
import { createCrudPermissions } from '../factories/permission.factory';
import { AuthHelper } from '../helpers/auth.helper';

export interface AuthFixture {
  tenant: any;
  admin: any;
  manager: any;
  user: any;
  viewer: any;
  roles: {
    admin: any;
    manager: any;
    user: any;
    viewer: any;
  };
  permissions: {
    user: any;
    tenant: any;
  };
  tokens: {
    admin: { accessToken: string; refreshToken: string };
    manager: { accessToken: string; refreshToken: string };
    user: { accessToken: string; refreshToken: string };
    viewer: { accessToken: string; refreshToken: string };
  };
}

/**
 * Create a complete auth fixture with tenant, users, roles, and permissions
 */
export async function createAuthFixture(
  prisma: PrismaClient,
): Promise<AuthFixture> {
  const authHelper = new AuthHelper();

  // Create tenant
  const tenant = await createTenant(prisma, {
    name: 'Test Company',
    slug: 'test-company',
  });

  // Create roles
  const roles = await createSystemRoles(prisma);

  // Create permissions
  const userPermissions = await createCrudPermissions(prisma, 'user');
  const tenantPermissions = await createCrudPermissions(prisma, 'tenant');

  // Assign permissions to roles
  await prisma.rolePermission.createMany({
    data: [
      // Admin gets all permissions
      { roleId: roles.admin.id, permissionId: userPermissions.create.id },
      { roleId: roles.admin.id, permissionId: userPermissions.read.id },
      { roleId: roles.admin.id, permissionId: userPermissions.update.id },
      { roleId: roles.admin.id, permissionId: userPermissions.delete.id },
      { roleId: roles.admin.id, permissionId: userPermissions.list.id },
      { roleId: roles.admin.id, permissionId: tenantPermissions.create.id },
      { roleId: roles.admin.id, permissionId: tenantPermissions.read.id },
      { roleId: roles.admin.id, permissionId: tenantPermissions.update.id },
      { roleId: roles.admin.id, permissionId: tenantPermissions.delete.id },
      { roleId: roles.admin.id, permissionId: tenantPermissions.list.id },
      // Manager gets read, update, list
      { roleId: roles.manager.id, permissionId: userPermissions.read.id },
      { roleId: roles.manager.id, permissionId: userPermissions.update.id },
      { roleId: roles.manager.id, permissionId: userPermissions.list.id },
      { roleId: roles.manager.id, permissionId: tenantPermissions.read.id },
      { roleId: roles.manager.id, permissionId: tenantPermissions.list.id },
      // User gets read and list
      { roleId: roles.user.id, permissionId: userPermissions.read.id },
      { roleId: roles.user.id, permissionId: userPermissions.list.id },
      // Viewer gets only read
      { roleId: roles.viewer.id, permissionId: userPermissions.read.id },
      { roleId: roles.viewer.id, permissionId: tenantPermissions.read.id },
    ],
  });

  // Create users
  const admin = await createUser(prisma, tenant.id, {
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
  });

  const manager = await createUser(prisma, tenant.id, {
    email: 'manager@test.com',
    firstName: 'Manager',
    lastName: 'User',
  });

  const user = await createUser(prisma, tenant.id, {
    email: 'user@test.com',
    firstName: 'Regular',
    lastName: 'User',
  });

  const viewer = await createUser(prisma, tenant.id, {
    email: 'viewer@test.com',
    firstName: 'Viewer',
    lastName: 'User',
  });

  // Assign roles to users
  await prisma.userRole.createMany({
    data: [
      { userId: admin.id, roleId: roles.admin.id },
      { userId: manager.id, roleId: roles.manager.id },
      { userId: user.id, roleId: roles.user.id },
      { userId: viewer.id, roleId: roles.viewer.id },
    ],
  });

  // Generate tokens
  const tokens = {
    admin: authHelper.generateTokens({
      sub: admin.id,
      email: admin.email,
      tenantId: tenant.id,
      roles: ['admin'],
    }),
    manager: authHelper.generateTokens({
      sub: manager.id,
      email: manager.email,
      tenantId: tenant.id,
      roles: ['manager'],
    }),
    user: authHelper.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      roles: ['user'],
    }),
    viewer: authHelper.generateTokens({
      sub: viewer.id,
      email: viewer.email,
      tenantId: tenant.id,
      roles: ['viewer'],
    }),
  };

  return {
    tenant,
    admin,
    manager,
    user,
    viewer,
    roles,
    permissions: {
      user: userPermissions,
      tenant: tenantPermissions,
    },
    tokens,
  };
}
