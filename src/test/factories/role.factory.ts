/**
 * Role Factory
 * Creates test role entities with realistic data
 */

import { faker } from '@faker-js/faker';
import { Prisma, Role } from '@prisma/client';

export interface RoleFactoryOptions {
  id?: string;
  name?: string;
  description?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Create role data for testing
 */
export function createRoleData(
  overrides?: RoleFactoryOptions,
): Prisma.RoleCreateInput {
  return {
    id: overrides?.id || faker.string.uuid(),
    name: overrides?.name || faker.helpers.arrayElement([
      'admin',
      'manager',
      'user',
      'viewer',
      'editor',
      'developer',
    ]),
    description: overrides?.description || faker.lorem.sentence(),
    createdBy: overrides?.createdBy || null,
    updatedBy: overrides?.updatedBy || null,
  };
}

/**
 * Create multiple role data objects
 */
export function createRoleDataBatch(
  count: number,
  overrides?: RoleFactoryOptions,
): Prisma.RoleCreateInput[] {
  return Array.from({ length: count }, () => createRoleData(overrides));
}

/**
 * Create a role entity (for use with Prisma)
 */
export async function createRole(
  prisma: any,
  overrides?: RoleFactoryOptions,
): Promise<Role> {
  const data = createRoleData(overrides);
  return prisma.role.create({ data });
}

/**
 * Create multiple role entities
 */
export async function createRoleBatch(
  prisma: any,
  count: number,
  overrides?: RoleFactoryOptions,
): Promise<Role[]> {
  const roles: Role[] = [];
  for (let i = 0; i < count; i++) {
    roles.push(await createRole(prisma, overrides));
  }
  return roles;
}

/**
 * Create standard system roles
 */
export async function createSystemRoles(prisma: any): Promise<{
  admin: Role;
  manager: Role;
  user: Role;
  viewer: Role;
}> {
  const admin = await createRole(prisma, {
    name: 'admin',
    description: 'Administrator with full access',
  });

  const manager = await createRole(prisma, {
    name: 'manager',
    description: 'Manager with elevated permissions',
  });

  const user = await createRole(prisma, {
    name: 'user',
    description: 'Standard user with basic permissions',
  });

  const viewer = await createRole(prisma, {
    name: 'viewer',
    description: 'Read-only access',
  });

  return { admin, manager, user, viewer };
}
