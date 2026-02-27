import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RolesSeeder } from './seeders/roles.seeder';
import { PermissionsSeeder } from './seeders/permissions.seeder';
import { RolePermissionsSeeder } from './seeders/role-permissions.seeder';
import { SystemConfigSeeder } from './seeders/system-config.seeder';

const prisma = new PrismaClient();

/**
 * Development seed script
 * Seeds the database with development data including sample users
 */
async function seedDevelopment() {
  console.log('Starting development seeding...');

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

    // Seed development-specific data
    await seedDevelopmentTenant();
    await seedDevelopmentUsers();

    console.log('Development seeding completed successfully');
  } catch (error) {
    console.error('Development seeding failed:', error);
    throw error;
  }
}

/**
 * Seed a development tenant
 */
async function seedDevelopmentTenant() {
  console.log('[DevelopmentSeed] Seeding tenant...');

  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: 'dev-tenant' },
  });

  if (existingTenant) {
    console.log('[DevelopmentSeed] Tenant already exists, skipping...');
    return;
  }

  await prisma.tenant.create({
    data: {
      name: 'Development Tenant',
      slug: 'dev-tenant',
      isActive: true,
    },
  });

  console.log('[DevelopmentSeed] Tenant created');
}

/**
 * Seed development users with different roles
 */
async function seedDevelopmentUsers() {
  console.log('[DevelopmentSeed] Seeding users...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'dev-tenant' },
  });

  if (!tenant) {
    console.error('[DevelopmentSeed] Tenant not found');
    return;
  }

  const roles = await prisma.role.findMany();
  const adminRole = roles.find((r) => r.name === 'admin');
  const managerRole = roles.find((r) => r.name === 'manager');
  const userRole = roles.find((r) => r.name === 'user');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // Create admin user
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@dev.local' },
  });

  if (!adminExists && adminRole) {
    const admin = await prisma.user.create({
      data: {
        email: 'admin@dev.local',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        tenantId: tenant.id,
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    });

    console.log('[DevelopmentSeed] Admin user created: admin@dev.local');
  }

  // Create manager user
  const managerExists = await prisma.user.findUnique({
    where: { email: 'manager@dev.local' },
  });

  if (!managerExists && managerRole) {
    const manager = await prisma.user.create({
      data: {
        email: 'manager@dev.local',
        password: hashedPassword,
        firstName: 'Manager',
        lastName: 'User',
        tenantId: tenant.id,
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: manager.id,
        roleId: managerRole.id,
      },
    });

    console.log('[DevelopmentSeed] Manager user created: manager@dev.local');
  }

  // Create regular user
  const userExists = await prisma.user.findUnique({
    where: { email: 'user@dev.local' },
  });

  if (!userExists && userRole) {
    const user = await prisma.user.create({
      data: {
        email: 'user@dev.local',
        password: hashedPassword,
        firstName: 'Regular',
        lastName: 'User',
        tenantId: tenant.id,
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: userRole.id,
      },
    });

    console.log('[DevelopmentSeed] Regular user created: user@dev.local');
  }

  console.log('[DevelopmentSeed] Users seeding completed');
}

// Run the seed
seedDevelopment()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
