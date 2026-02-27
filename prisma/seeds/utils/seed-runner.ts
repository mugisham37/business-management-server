import { PrismaClient } from '@prisma/client';
import { BaseSeeder } from './base-seeder';

/**
 * Seed runner with dependency ordering and error handling
 */
export class SeedRunner {
  private seeders: Map<string, BaseSeeder> = new Map();
  private executionOrder: string[] = [];

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register a seeder
   */
  register(seeder: BaseSeeder): void {
    this.seeders.set(seeder.getName(), seeder);
  }

  /**
   * Run all registered seeders in dependency order
   */
  async runAll(): Promise<void> {
    console.log('Starting seed execution...');

    // Calculate execution order based on dependencies
    this.calculateExecutionOrder();

    console.log(
      `Execution order: ${this.executionOrder.join(' -> ')}`,
    );

    // Execute seeders in order
    for (const seederName of this.executionOrder) {
      const seeder = this.seeders.get(seederName);
      if (!seeder) {
        throw new Error(`Seeder ${seederName} not found`);
      }

      try {
        await seeder.seed();
      } catch (error) {
        console.error(
          `Failed to execute seeder ${seederName}:`,
          error,
        );
        throw error;
      }
    }

    console.log('All seeders executed successfully');
  }

  /**
   * Rollback all registered seeders in reverse order
   */
  async rollbackAll(): Promise<void> {
    console.log('Starting seed rollback...');

    // Calculate execution order
    this.calculateExecutionOrder();

    // Rollback in reverse order
    const rollbackOrder = [...this.executionOrder].reverse();

    console.log(
      `Rollback order: ${rollbackOrder.join(' -> ')}`,
    );

    for (const seederName of rollbackOrder) {
      const seeder = this.seeders.get(seederName);
      if (!seeder) {
        console.warn(`Seeder ${seederName} not found, skipping...`);
        continue;
      }

      try {
        await seeder.rollback();
      } catch (error) {
        console.error(
          `Failed to rollback seeder ${seederName}:`,
          error,
        );
        // Continue with other rollbacks even if one fails
      }
    }

    console.log('All seeders rolled back');
  }

  /**
   * Calculate execution order using topological sort
   */
  private calculateExecutionOrder(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (seederName: string) => {
      if (visited.has(seederName)) {
        return;
      }

      if (visiting.has(seederName)) {
        throw new Error(
          `Circular dependency detected involving ${seederName}`,
        );
      }

      visiting.add(seederName);

      const seeder = this.seeders.get(seederName);
      if (!seeder) {
        throw new Error(`Seeder ${seederName} not found`);
      }

      // Visit dependencies first
      const dependencies = seeder.getDependencies();
      for (const dep of dependencies) {
        if (!this.seeders.has(dep)) {
          throw new Error(
            `Dependency ${dep} of ${seederName} not registered`,
          );
        }
        visit(dep);
      }

      visiting.delete(seederName);
      visited.add(seederName);
      order.push(seederName);
    };

    // Visit all seeders
    const seederNames = Array.from(this.seeders.keys());
    for (const seederName of seederNames) {
      visit(seederName);
    }

    this.executionOrder = order;
  }
}
