/**
 * Authentication and authorization constants
 */

/**
 * JWT configuration
 */
export const JWT_CONFIG = {
  /**
   * Access token expiry: 15 minutes
   */
  ACCESS_TOKEN_EXPIRY: '15m',

  /**
   * Refresh token expiry: 7 days
   */
  REFRESH_TOKEN_EXPIRY: '7d',

  /**
   * Access token expiry in seconds (for numeric calculations)
   */
  ACCESS_TOKEN_EXPIRY_SECONDS: 900,

  /**
   * Refresh token expiry in seconds (for numeric calculations)
   */
  REFRESH_TOKEN_EXPIRY_SECONDS: 604800,
} as const;

/**
 * Password and PIN configuration
 */
export const PASSWORD_CONFIG = {
  /**
   * Bcrypt rounds for password hashing
   */
  BCRYPT_ROUNDS: 10,

  /**
   * Minimum password length
   */
  MIN_PASSWORD_LENGTH: 8,

  /**
   * Password regex pattern
   * At least 8 characters, one uppercase, one lowercase, one number, one special character
   */
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,

  /**
   * PIN regex pattern (4-6 digits)
   */
  PIN_REGEX: /^\d{4,6}$/,

  /**
   * Number of previous passwords to check for reuse
   */
  PASSWORD_HISTORY_COUNT: 3,
} as const;

/**
 * Account security configuration
 */
export const SECURITY_CONFIG = {
  /**
   * Maximum failed login attempts before lockout
   */
  MAX_FAILED_LOGIN_ATTEMPTS: 5,

  /**
   * Account lockout duration in minutes
   */
  LOCKOUT_DURATION_MINUTES: 30,

  /**
   * Rate limit for login attempts per email
   */
  LOGIN_RATE_LIMIT_MAX: 5,

  /**
   * Rate limit window in seconds (15 minutes)
   */
  LOGIN_RATE_LIMIT_WINDOW: 900,
} as const;

/**
 * Authorization layer names
 */
export const AUTHORIZATION_LAYERS = {
  HIERARCHY: 'HIERARCHY_LEVEL_CHECK',
  MODULE_PERMISSION: 'MODULE_PERMISSION_CHECK',
  SCOPE: 'SCOPE_CHECK',
  BUSINESS_RULES: 'BUSINESS_RULES_CHECK',
} as const;
