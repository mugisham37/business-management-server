import { PrismaClient } from '@prisma/client';
import { BaseSeeder } from '../utils/base-seeder';
import { SeedValidator } from '../utils/seed-validator';
import { permissionsSeedData } from '../data/permissions.seed';

/**
 * Permissions seeder
 * Seeds the base permissions for the system
 */
export class PermissionsSeeder extends BaseSeeder {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  getName(): string {
    return 'PermissionsSeeder';
  }

  async seed(): Promise<void> {
    this.log('Starting permissions seeding...');

    for (const permissionData of permissionsSeedData) {
      // Validate seed data
      SeedValidator.validateRequired(permissionData, [
        'name',
        'resource',
        'action',
        'description',
      ]);

      // Check if permission already exists (idempotent)
      const exists = await this.exists(this.prisma.permission, {
        name: permissionData.name,
      });

      if (exists) {
        this.log(
          `Permission '${permissionData.name}' already exists, skipping...`,
        );
        continue;
      }

      // Create permission
      await this.prisma.permission.create({
        data: {
          name: permissionData.name,
          resource: permissionData.resource,
          action: permissionData.action,
          description: permissionData.description,
        },
      });

      this.log(`Created permission: ${permissionData.name}`);
    }

    this.log('Permissions seeding completed');
  }

  async rollback(): Promise<void> {
    this.log('Rolling back permissions...');

    const permissionNames = permissionsSeedData.map((p) => p.name);

    await this.prisma.permission.deleteMany({
      where: {
        name: {
          in: permissionNames,
        },
      },
    });

    this.log('Permissions rollback completed');
  }
}
