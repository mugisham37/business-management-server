import { PrismaClient } from '@prisma/client';
import { BaseSeeder } from '../utils/base-seeder';
import { rolePermissionMappings } from '../data/role-permissions.seed';

/**
 * Role-Permissions seeder
 * Seeds the role-permission mappings
 */
export class RolePermissionsSeeder extends BaseSeeder {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  getName(): string {
    return 'RolePermissionsSeeder';
  }

  getDependencies(): string[] {
    return ['RolesSeeder', 'PermissionsSeeder'];
  }

  async seed(): Promise<void> {
    this.log('Starting role-permissions seeding...');

    for (const mapping of rolePermissionMappings) {
      // Find the role
      const role = await this.prisma.role.findUnique({
        where: { name: mapping.roleName },
      });

      if (!role) {
        this.logError(`Role '${mapping.roleName}' not found, skipping...`);
        continue;
      }

      // Process each permission
      for (const permissionName of mapping.permissionNames) {
        // Find the permission
        const permission = await this.prisma.permission.findUnique({
          where: { name: permissionName },
        });

        if (!permission) {
          this.logError(
            `Permission '${permissionName}' not found, skipping...`,
          );
          continue;
        }

        // Check if mapping already exists (idempotent)
        const exists = await this.prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
        });

        if (exists) {
          continue;
        }

        // Create the mapping
        await this.prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }

      this.log(
        `Assigned ${mapping.permissionNames.length} permissions to role '${mapping.roleName}'`,
      );
    }

    this.log('Role-permissions seeding completed');
  }

  async rollback(): Promise<void> {
    this.log('Rolling back role-permissions...');

    for (const mapping of rolePermissionMappings) {
      const role = await this.prisma.role.findUnique({
        where: { name: mapping.roleName },
      });

      if (!role) {
        continue;
      }

      await this.prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
        },
      });
    }

    this.log('Role-permissions rollback completed');
  }
}
