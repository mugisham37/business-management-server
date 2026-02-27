import { PrismaClient } from '@prisma/client';
import { SeedRunner } from './utils/seed-runner';
import { RolesSeeder } from './seeders/roles.seeder';
import { PermissionsSeeder } from './seeders/permissions.seeder';
import { RolePermissionsSeeder } from './seeders/role-permissions.seeder';
import { SystemConfigSeeder } from './seeders/system-config.seeder';

const prisma = new PrismaClient();

/**
 * Main seed entry point
 * Runs all base seeders with dependency ordering
 */
async function main() {
  console.log('Starting database seeding...');

  const runner = new SeedRunner(prisma);

  // Register all seeders
  runner.register(new RolesSeeder(prisma));
  runner.register(new PermissionsSeeder(prisma));
  runner.register(new RolePermissionsSeeder(prisma));
  runner.register(new SystemConfigSeeder(prisma));

  // Check if rollback is requested
  const shouldRollback = process.argv.includes('--rollback');

  try {
    if (shouldRollback) {
      await runner.rollbackAll();
      console.log('Database seed rollback completed successfully');
    } else {
      await runner.runAll();
      console.log('Database seeding completed successfully');
    }
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
