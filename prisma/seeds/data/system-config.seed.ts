/**
 * System configuration seed data
 * Defines the base system configuration
 */

export interface SystemConfigSeedData {
  key: string;
  value: any;
  description: string;
  isPublic: boolean;
}

export const systemConfigSeedData: SystemConfigSeedData[] = [
  {
    key: 'app.name',
    value: 'ERP System',
    description: 'Application name',
    isPublic: true,
  },
  {
    key: 'app.version',
    value: '1.0.0',
    description: 'Application version',
    isPublic: true,
  },
  {
    key: 'app.environment',
    value: process.env.NODE_ENV || 'development',
    description: 'Application environment',
    isPublic: false,
  },
  {
    key: 'security.session.timeout',
    value: 3600,
    description: 'Session timeout in seconds',
    isPublic: false,
  },
  {
    key: 'security.password.minLength',
    value: 8,
    description: 'Minimum password length',
    isPublic: true,
  },
  {
    key: 'security.password.requireUppercase',
    value: true,
    description: 'Require uppercase letters in password',
    isPublic: true,
  },
  {
    key: 'security.password.requireLowercase',
    value: true,
    description: 'Require lowercase letters in password',
    isPublic: true,
  },
  {
    key: 'security.password.requireNumbers',
    value: true,
    description: 'Require numbers in password',
    isPublic: true,
  },
  {
    key: 'security.password.requireSpecialChars',
    value: true,
    description: 'Require special characters in password',
    isPublic: true,
  },
  {
    key: 'security.maxLoginAttempts',
    value: 5,
    description: 'Maximum login attempts before account lockout',
    isPublic: false,
  },
  {
    key: 'cache.defaultTTL',
    value: 300,
    description: 'Default cache TTL in seconds',
    isPublic: false,
  },
  {
    key: 'pagination.defaultPageSize',
    value: 20,
    description: 'Default page size for pagination',
    isPublic: true,
  },
  {
    key: 'pagination.maxPageSize',
    value: 100,
    description: 'Maximum page size for pagination',
    isPublic: true,
  },
];
