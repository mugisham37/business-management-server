import { PrismaClient } from '@prisma/client';

/**
 * Base seeder class with common functionality
 */
export abstract class BaseSeeder {
  constructor(protected readonly prisma: PrismaClient) {}

  /**
   * Execute the seed operation
   */
  abstract seed(): Promise<void>;

  /**
   * Rollback the seed operation
   */
  abstract rollback(): Promise<void>;

  /**
   * Get the name of the seeder
   */
  abstract getName(): string;

  /**
   * Get dependencies (other seeders that must run before this one)
   */
  getDependencies(): string[] {
    return [];
  }

  /**
   * Check if a record exists by unique field
   */
  protected async exists<T>(
    model: any,
    where: any,
  ): Promise<boolean> {
    const record = await model.findUnique({ where });
    return record !== null;
  }

  /**
   * Upsert a record (create if not exists, update if exists)
   */
  protected async upsert<T>(
    model: any,
    where: any,
    create: any,
    update: any = {},
  ): Promise<T> {
    return model.upsert({
      where,
      create,
      update,
    });
  }

  /**
   * Log seeder progress
   */
  protected log(message: string): void {
    console.log(`[${this.getName()}] ${message}`);
  }

  /**
   * Log seeder error
   */
  protected logError(message: string, error?: any): void {
    console.error(`[${this.getName()}] ERROR: ${message}`, error);
  }
}
