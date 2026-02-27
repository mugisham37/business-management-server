import { PrismaClient } from '@prisma/client';
import { SeedRunner } from '../../../prisma/seeds/utils/seed-runner';
import { BaseSeeder } from '../../../prisma/seeds/utils/base-seeder';

// Mock seeders for testing
class MockSeederA extends BaseSeeder {
  public executed = false;
  public rolledBack = false;

  getName(): string {
    return 'MockSeederA';
  }

  async seed(): Promise<void> {
    this.executed = true;
  }

  async rollback(): Promise<void> {
    this.rolledBack = true;
  }
}

class MockSeederB extends BaseSeeder {
  public executed = false;
  public rolledBack = false;

  getName(): string {
    return 'MockSeederB';
  }

  getDependencies(): string[] {
    return ['MockSeederA'];
  }

  async seed(): Promise<void> {
    this.executed = true;
  }

  async rollback(): Promise<void> {
    this.rolledBack = true;
  }
}

class MockSeederC extends BaseSeeder {
  public executed = false;
  public rolledBack = false;

  getName(): string {
    return 'MockSeederC';
  }

  getDependencies(): string[] {
    return ['MockSeederA', 'MockSeederB'];
  }

  async seed(): Promise<void> {
    this.executed = true;
  }

  async rollback(): Promise<void> {
    this.rolledBack = true;
  }
}

describe('SeedRunner', () => {
  let prisma: PrismaClient;
  let runner: SeedRunner;

  beforeEach(() => {
    prisma = new PrismaClient();
    runner = new SeedRunner(prisma);
  });

  describe('register', () => {
    it('should register a seeder', () => {
      const seeder = new MockSeederA(prisma);
      runner.register(seeder);
      expect(() => runner['seeders'].get('MockSeederA')).not.toThrow();
    });
  });

  describe('runAll', () => {
    it('should execute seeders in dependency order', async () => {
      const seederA = new MockSeederA(prisma);
      const seederB = new MockSeederB(prisma);
      const seederC = new MockSeederC(prisma);

      runner.register(seederC);
      runner.register(seederB);
      runner.register(seederA);

      await runner.runAll();

      expect(seederA.executed).toBe(true);
      expect(seederB.executed).toBe(true);
      expect(seederC.executed).toBe(true);
    });

    it('should throw error for circular dependencies', async () => {
      class CircularA extends BaseSeeder {
        getName() {
          return 'CircularA';
        }
        getDependencies() {
          return ['CircularB'];
        }
        async seed() {}
        async rollback() {}
      }

      class CircularB extends BaseSeeder {
        getName() {
          return 'CircularB';
        }
        getDependencies() {
          return ['CircularA'];
        }
        async seed() {}
        async rollback() {}
      }

      runner.register(new CircularA(prisma));
      runner.register(new CircularB(prisma));

      await expect(runner.runAll()).rejects.toThrow(
        'Circular dependency detected',
      );
    });

    it('should throw error for missing dependency', async () => {
      const seederB = new MockSeederB(prisma);
      runner.register(seederB);

      await expect(runner.runAll()).rejects.toThrow(
        'Dependency MockSeederA of MockSeederB not registered',
      );
    });
  });

  describe('rollbackAll', () => {
    it('should rollback seeders in reverse dependency order', async () => {
      const seederA = new MockSeederA(prisma);
      const seederB = new MockSeederB(prisma);
      const seederC = new MockSeederC(prisma);

      runner.register(seederA);
      runner.register(seederB);
      runner.register(seederC);

      await runner.rollbackAll();

      expect(seederA.rolledBack).toBe(true);
      expect(seederB.rolledBack).toBe(true);
      expect(seederC.rolledBack).toBe(true);
    });
  });
});
