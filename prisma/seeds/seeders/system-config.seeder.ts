import { PrismaClient } from '@prisma/client';
import { BaseSeeder } from '../utils/base-seeder';
import { SeedValidator } from '../utils/seed-validator';
import { systemConfigSeedData } from '../data/system-config.seed';

/**
 * System configuration seeder
 * Seeds the base system configuration
 */
export class SystemConfigSeeder extends BaseSeeder {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  getName(): string {
    return 'SystemConfigSeeder';
  }

  async seed(): Promise<void> {
    this.log('Starting system configuration seeding...');

    for (const configData of systemConfigSeedData) {
      // Validate seed data
      SeedValidator.validateRequired(configData, [
        'key',
        'value',
        'description',
      ]);

      // Upsert configuration (idempotent - update if exists)
      await this.upsert(
        this.prisma.systemConfig,
        { key: configData.key },
        {
          key: configData.key,
          value: configData.value,
          description: configData.description,
          isPublic: configData.isPublic,
        },
        {
          value: configData.value,
          description: configData.description,
          isPublic: configData.isPublic,
        },
      );

      this.log(`Seeded config: ${configData.key}`);
    }

    this.log('System configuration seeding completed');
  }

  async rollback(): Promise<void> {
    this.log('Rolling back system configuration...');

    const configKeys = systemConfigSeedData.map((c) => c.key);

    await this.prisma.systemConfig.deleteMany({
      where: {
        key: {
          in: configKeys,
        },
      },
    });

    this.log('System configuration rollback completed');
  }
}
