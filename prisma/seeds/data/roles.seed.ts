/**
 * Role seed data
 * Defines the base roles for the system
 */

export interface RoleSeedData {
  name: string;
  description: string;
}

export const rolesSeedData: RoleSeedData[] = [
  {
    name: 'admin',
    description: 'System administrator with full access to all resources',
  },
  {
    name: 'manager',
    description: 'Manager with access to manage team and resources',
  },
  {
    name: 'user',
    description: 'Standard user with basic access permissions',
  },
];
