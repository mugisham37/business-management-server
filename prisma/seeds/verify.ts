/**
 * Verification script to test seed data structure
 * This script validates that all seed data is properly structured
 */

import { rolesSeedData } from './data/roles.seed';
import { permissionsSeedData } from './data/permissions.seed';
import { rolePermissionMappings } from './data/role-permissions.seed';
import { systemConfigSeedData } from './data/system-config.seed';
import { SeedValidator } from './utils/seed-validator';

console.log('Verifying seed data structure...\n');

// Verify roles
console.log('✓ Roles:');
rolesSeedData.forEach((role) => {
  SeedValidator.validateRequired(role, ['name', 'description']);
  console.log(`  - ${role.name}: ${role.description}`);
});
console.log(`  Total: ${rolesSeedData.length} roles\n`);

// Verify permissions
console.log('✓ Permissions:');
const resourceGroups = new Map<string, number>();
permissionsSeedData.forEach((permission) => {
  SeedValidator.validateRequired(permission, [
    'name',
    'resource',
    'action',
    'description',
  ]);
  resourceGroups.set(
    permission.resource,
    (resourceGroups.get(permission.resource) || 0) + 1,
  );
});
resourceGroups.forEach((count, resource) => {
  console.log(`  - ${resource}: ${count} permissions`);
});
console.log(`  Total: ${permissionsSeedData.length} permissions\n`);

// Verify role-permission mappings
console.log('✓ Role-Permission Mappings:');
rolePermissionMappings.forEach((mapping) => {
  console.log(
    `  - ${mapping.roleName}: ${mapping.permissionNames.length} permissions`,
  );
});
console.log();

// Verify system config
console.log('✓ System Configuration:');
const configGroups = new Map<string, number>();
systemConfigSeedData.forEach((config) => {
  SeedValidator.validateRequired(config, ['key', 'value', 'description']);
  const category = config.key.split('.')[0];
  configGroups.set(category, (configGroups.get(category) || 0) + 1);
});
configGroups.forEach((count, category) => {
  console.log(`  - ${category}: ${count} configs`);
});
console.log(`  Total: ${systemConfigSeedData.length} configs\n`);

// Verify role-permission mapping integrity
console.log('✓ Verifying mapping integrity:');
const roleNames = rolesSeedData.map((r) => r.name);
const permissionNames = permissionsSeedData.map((p) => p.name);

let mappingErrors = 0;
rolePermissionMappings.forEach((mapping) => {
  if (!roleNames.includes(mapping.roleName)) {
    console.error(`  ✗ Role '${mapping.roleName}' not found in roles seed data`);
    mappingErrors++;
  }

  mapping.permissionNames.forEach((permName) => {
    if (!permissionNames.includes(permName)) {
      console.error(
        `  ✗ Permission '${permName}' not found in permissions seed data`,
      );
      mappingErrors++;
    }
  });
});

if (mappingErrors === 0) {
  console.log('  All mappings are valid\n');
} else {
  console.error(`  Found ${mappingErrors} mapping errors\n`);
  process.exit(1);
}

console.log('✅ All seed data is properly structured and valid!');
console.log('\nSummary:');
console.log(`  - ${rolesSeedData.length} roles`);
console.log(`  - ${permissionsSeedData.length} permissions`);
console.log(`  - ${rolePermissionMappings.length} role-permission mappings`);
console.log(`  - ${systemConfigSeedData.length} system configs`);
console.log('\nReady to seed the database!');
