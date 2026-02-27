/**
 * Tenant Factory
 * Creates test tenant entities with realistic data
 */

import { faker } from '@faker-js/faker';
import { Prisma, Tenant } from '@prisma/client';

export interface TenantFactoryOptions {
  id?: string;
  name?: string;
  slug?: string;
  isActive?: boolean;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Create tenant data for testing
 */
export function createTenantData(
  overrides?: TenantFactoryOptions,
): Prisma.TenantCreateInput {
  const name = overrides?.name || faker.company.name();
  const slug =
    overrides?.slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  return {
    id: overrides?.id || faker.string.uuid(),
    name,
    slug,
    isActive: overrides?.isActive ?? true,
    createdBy: overrides?.createdBy || null,
    updatedBy: overrides?.updatedBy || null,
  };
}

/**
 * Create multiple tenant data objects
 */
export function createTenantDataBatch(
  count: number,
  overrides?: TenantFactoryOptions,
): Prisma.TenantCreateInput[] {
  return Array.from({ length: count }, () => createTenantData(overrides));
}

/**
 * Create a tenant entity (for use with Prisma)
 */
export async function createTenant(
  prisma: any,
  overrides?: TenantFactoryOptions,
): Promise<Tenant> {
  const data = createTenantData(overrides);
  return prisma.tenant.create({ data });
}

/**
 * Create multiple tenant entities
 */
export async function createTenantBatch(
  prisma: any,
  count: number,
  overrides?: TenantFactoryOptions,
): Promise<Tenant[]> {
  const tenants: Tenant[] = [];
  for (let i = 0; i < count; i++) {
    tenants.push(await createTenant(prisma, overrides));
  }
  return tenants;
}
