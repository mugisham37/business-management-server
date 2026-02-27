import { PrismaClient } from '@prisma/client';
import { RolesSeeder } from '../../../prisma/seeds/seeders/roles.seeder';
import { PermissionsSeeder } from '../../../prisma/seeds/seeders/permissions.seeder';
import { RolePermissionsSeeder } from '../../../prisma/seeds/seeders/role-permissions.seeder';
import { SystemConfigSeeder } from '../../../prisma/seeds/seeders/system-config.seeder';
import { rolesSeedData } from '../../../prisma/seeds/data/roles.seed';
import { permissionsSeedData } from '../../../prisma/seeds/data/permissions.seed';
import { systemConfigSeedData } from '../../../prisma/seeds/data/system-config.seed';

describe.skip('Seeders Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('RolesSeeder', () => {
    let seeder: RolesSeeder;

    beforeEach(async () => {
      seeder = new RolesSeeder(prisma);
      await seeder.rollback();
    });

    afterEach(async () => {
      await seeder.rollback();
    });

    it('should seed roles', async () => {
      await seeder.seed();

      const roles = await prisma.role.findMany({
        where: {
          name: {
            in: rolesSeedData.map((r) => r.name),
          },
        },
      });

      expect(roles).toHaveLength(rolesSeedData.length);
    });

    it('should be idempotent', async () => {
      await seeder.seed();
      await seeder.seed();

      const roles = await prisma.role.findMany({
        where: {
          name: {
            in: rolesSeedData.map((r) => r.name),
          },
        },
      });

      expect(roles).toHaveLength(rolesSeedData.length);
    });

    it('should rollback roles', async () => {
      await seeder.seed();
      await seeder.rollback();

      const roles = await prisma.role.findMany({
        where: {
          name: {
            in: rolesSeedData.map((r) => r.name),
          },
        },
      });

      expect(roles).toHaveLength(0);
    });
  });

  describe('PermissionsSeeder', () => {
    let seeder: PermissionsSeeder;

    beforeEach(async () => {
      seeder = new PermissionsSeeder(prisma);
      await seeder.rollback();
    });

    afterEach(async () => {
      await seeder.rollback();
    });

    it('should seed permissions', async () => {
      await seeder.seed();

      const permissions = await prisma.permission.findMany({
        where: {
          name: {
            in: permissionsSeedData.map((p) => p.name),
          },
        },
      });

      expect(permissions).toHaveLength(permissionsSeedData.length);
    });

    it('should be idempotent', async () => {
      await seeder.seed();
      await seeder.seed();

      const permissions = await prisma.permission.findMany({
        where: {
          name: {
            in: permissionsSeedData.map((p) => p.name),
          },
        },
      });

      expect(permissions).toHaveLength(permissionsSeedData.length);
    });
  });

  describe('RolePermissionsSeeder', () => {
    let rolesSeeder: RolesSeeder;
    let permissionsSeeder: PermissionsSeeder;
    let seeder: RolePermissionsSeeder;

    beforeEach(async () => {
      rolesSeeder = new RolesSeeder(prisma);
      permissionsSeeder = new PermissionsSeeder(prisma);
      seeder = new RolePermissionsSeeder(prisma);

      await seeder.rollback();
      await rolesSeeder.rollback();
      await permissionsSeeder.rollback();

      await rolesSeeder.seed();
      await permissionsSeeder.seed();
    });

    afterEach(async () => {
      await seeder.rollback();
      await rolesSeeder.rollback();
      await permissionsSeeder.rollback();
    });

    it('should seed role-permission mappings', async () => {
      await seeder.seed();

      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
        include: { permissions: true },
      });

      expect(adminRole).toBeDefined();
      expect(adminRole?.permissions.length).toBeGreaterThan(0);
    });

    it('should be idempotent', async () => {
      await seeder.seed();
      const firstCount = await prisma.rolePermission.count();

      await seeder.seed();
      const secondCount = await prisma.rolePermission.count();

      expect(firstCount).toBe(secondCount);
    });
  });

  describe('SystemConfigSeeder', () => {
    let seeder: SystemConfigSeeder;

    beforeEach(async () => {
      seeder = new SystemConfigSeeder(prisma);
      await seeder.rollback();
    });

    afterEach(async () => {
      await seeder.rollback();
    });

    it('should seed system configuration', async () => {
      await seeder.seed();

      const configs = await prisma.systemConfig.findMany({
        where: {
          key: {
            in: systemConfigSeedData.map((c) => c.key),
          },
        },
      });

      expect(configs).toHaveLength(systemConfigSeedData.length);
    });

    it('should be idempotent and update existing configs', async () => {
      await seeder.seed();
      await seeder.seed();

      const configs = await prisma.systemConfig.findMany({
        where: {
          key: {
            in: systemConfigSeedData.map((c) => c.key),
          },
        },
      });

      expect(configs).toHaveLength(systemConfigSeedData.length);
    });
  });
});
