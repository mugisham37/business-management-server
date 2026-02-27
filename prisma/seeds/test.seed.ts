import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RolesSeeder } from './seeders/roles.seeder';
import { PermissionsSeeder } from './seeders/permissions.seeder';
import { RolePermissionsSeeder } from './seeders/role-permissions.seeder';
import { SystemConfigSeeder } from './seeders/system-config.seeder';

const prisma = new PrismaClient();

/**
 * Test seed script
 * Seeds the database with minimal test data
 */
async function seedTest() {
  console.log('Starting test seeding...');

  try {
    // Run base seeders
    const rolesSeeder = new RolesSeeder(prisma);
    await rolesSeeder.seed();

    const permissionsSeeder = new PermissionsSeeder(prisma);
    await permissionsSeeder.seed();

    const rolePermissionsSeeder = new RolePermissionsSeeder(prisma);
    await rolePermissionsSeeder.seed();

    const systemConfigSeeder = new SystemConfigSeeder(prisma);
    await systemConfigSeeder.seed();

    // Seed test-specific data
    await seedTestTenant();
    await seedTestUser();

    console.log('Test seeding completed successfully');
  } catch (error) {
    console.error('Test seeding failed:', error);
    throw error;
  }
}

/**
 * Seed a test tenant
 */
async function seedTestTenant() {
  console.log('[TestSeed] Seeding tenant...');

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: 'test-tenant' },
  });

  if (existingTenant) {
    console.log('[TestSeed] Tenant already exists, skipping...');
    return;
  }

  await prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      slug: 'test-tenant',
      isActive: true,
    },
  });

  console.log('[TestSeed] Tenant created');
}

/**
 * Seed a test user with admin role
 */
async function seedTestUser() {
  console.log('[TestSeed] Seeding user...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'test-tenant' },
  });

  if (!tenant) {
    console.error('[TestSeed] Tenant not found');
    return;
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: 'admin' },
  });

  if (!adminRole) {
    console.error('[TestSeed] Admin role not found');
    return;
  }

  const userExists = await prisma.user.findUnique({
    where: { email: 'test@test.local' },
  });

  if (userExists) {
    console.log('[TestSeed] User already exists, skipping...');
    return;
  }

  const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

  const user = await prisma.user.create({
    data: {
      email: 'test@test.local',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      tenantId: tenant.id,
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  console.log('[TestSeed] Test user created: test@test.local');
}

// Run the seed
seedTest()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
