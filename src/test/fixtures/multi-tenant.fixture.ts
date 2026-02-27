/**
 * Multi-Tenant Fixtures
 * Common multi-tenant test scenarios
 */

import { PrismaClient } from '@prisma/client';
import { createTenant } from '../factories/tenant.factory';
import { createUser } from '../factories/user.factory';

export interface MultiTenantFixture {
  tenants: {
    tenant1: any;
    tenant2: any;
    tenant3: any;
  };
  users: {
    tenant1Users: any[];
    tenant2Users: any[];
    tenant3Users: any[];
  };
}

/**
 * Create a multi-tenant fixture with multiple tenants and users
 */
export async function createMultiTenantFixture(
  prisma: PrismaClient,
): Promise<MultiTenantFixture> {
  // Create tenants
  const tenant1 = await createTenant(prisma, {
    name: 'Company A',
    slug: 'company-a',
  });

  const tenant2 = await createTenant(prisma, {
    name: 'Company B',
    slug: 'company-b',
  });

  const tenant3 = await createTenant(prisma, {
    name: 'Company C',
    slug: 'company-c',
  });

  // Create users for each tenant
  const tenant1Users = [
    await createUser(prisma, tenant1.id, {
      email: 'user1@company-a.com',
      firstName: 'User',
      lastName: 'One',
    }),
    await createUser(prisma, tenant1.id, {
      email: 'user2@company-a.com',
      firstName: 'User',
      lastName: 'Two',
    }),
  ];

  const tenant2Users = [
    await createUser(prisma, tenant2.id, {
      email: 'user1@company-b.com',
      firstName: 'User',
      lastName: 'One',
    }),
    await createUser(prisma, tenant2.id, {
      email: 'user2@company-b.com',
      firstName: 'User',
      lastName: 'Two',
    }),
  ];

  const tenant3Users = [
    await createUser(prisma, tenant3.id, {
      email: 'user1@company-c.com',
      firstName: 'User',
      lastName: 'One',
    }),
  ];

  return {
    tenants: {
      tenant1,
      tenant2,
      tenant3,
    },
    users: {
      tenant1Users,
      tenant2Users,
      tenant3Users,
    },
  };
}
