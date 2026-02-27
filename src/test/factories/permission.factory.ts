/**
 * Permission Factory
 * Creates test permission entities with realistic data
 */

import { faker } from '@faker-js/faker';
import { Prisma, Permission } from '@prisma/client';

export interface PermissionFactoryOptions {
  id?: string;
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Create permission data for testing
 */
export function createPermissionData(
  overrides?: PermissionFactoryOptions,
): Prisma.PermissionCreateInput {
  const resource =
    overrides?.resource ||
    faker.helpers.arrayElement([
      'user',
      'tenant',
      'role',
      'permission',
      'report',
      'invoice',
      'product',
    ]);
  const action =
    overrides?.action ||
    faker.helpers.arrayElement(['create', 'read', 'update', 'delete', 'list']);

  return {
    id: overrides?.id || faker.string.uuid(),
    name: overrides?.name || `${resource}:${action}`,
    resource,
    action,
    description: overrides?.description || faker.lorem.sentence(),
    createdBy: overrides?.createdBy || null,
    updatedBy: overrides?.updatedBy || null,
  };
}

/**
 * Create multiple permission data objects
 */
export function createPermissionDataBatch(
  count: number,
  overrides?: PermissionFactoryOptions,
): Prisma.PermissionCreateInput[] {
  return Array.from({ length: count }, () => createPermissionData(overrides));
}

/**
 * Create a permission entity (for use with Prisma)
 */
export async function createPermission(
  prisma: any,
  overrides?: PermissionFactoryOptions,
): Promise<Permission> {
  const data = createPermissionData(overrides);
  return prisma.permission.create({ data });
}

/**
 * Create multiple permission entities
 */
export async function createPermissionBatch(
  prisma: any,
  count: number,
  overrides?: PermissionFactoryOptions,
): Promise<Permission[]> {
  const permissions: Permission[] = [];
  for (let i = 0; i < count; i++) {
    permissions.push(await createPermission(prisma, overrides));
  }
  return permissions;
}

/**
 * Create standard CRUD permissions for a resource
 */
export async function createCrudPermissions(
  prisma: any,
  resource: string,
): Promise<{
  create: Permission;
  read: Permission;
  update: Permission;
  delete: Permission;
  list: Permission;
}> {
  const create = await createPermission(prisma, {
    name: `${resource}:create`,
    resource,
    action: 'create',
    description: `Create ${resource}`,
  });

  const read = await createPermission(prisma, {
    name: `${resource}:read`,
    resource,
    action: 'read',
    description: `Read ${resource}`,
  });

  const update = await createPermission(prisma, {
    name: `${resource}:update`,
    resource,
    action: 'update',
    description: `Update ${resource}`,
  });

  const deletePermission = await createPermission(prisma, {
    name: `${resource}:delete`,
    resource,
    action: 'delete',
    description: `Delete ${resource}`,
  });

  const list = await createPermission(prisma, {
    name: `${resource}:list`,
    resource,
    action: 'list',
    description: `List ${resource}`,
  });

  return {
    create,
    read,
    update,
    delete: deletePermission,
    list,
  };
}
