import { PrismaClient } from '@prisma/client';
import { BaseSeeder } from '../utils/base-seeder';
import { SeedValidator } from '../utils/seed-validator';
import { rolesSeedData } from '../data/roles.seed';

/**
 * Roles seeder
 * Seeds the base roles for the system
 */
export class RolesSeeder extends BaseSeeder {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  getName(): string {
    return 'RolesSeeder';
  }

  async seed(): Promise<void> {
    this.log('Starting roles seeding...');

    for (const roleData of rolesSeedData) {
      // Validate seed data
      SeedValidator.validateRequired(roleData, ['name', 'description']);

      // Check if role already exists (idempotent)
      const exists = await this.exists(this.prisma.role, {
        name: roleData.name,
      });

      if (exists) {
        this.log(`Role '${roleData.name}' already exists, skipping...`);
        continue;
      }

      // Create role
      await this.prisma.role.create({
        data: {
          name: roleData.name,
          description: roleData.description,
        },
      });

      this.log(`Created role: ${roleData.name}`);
    }

    this.log('Roles seeding completed');
  }

  async rollback(): Promise<void> {
    this.log('Rolling back roles...');

    const roleNames = rolesSeedData.map((r) => r.name);

    await this.prisma.role.deleteMany({
      where: {
        name: {
          in: roleNames,
        },
      },
    });

    this.log('Roles rollback completed');
  }
}
