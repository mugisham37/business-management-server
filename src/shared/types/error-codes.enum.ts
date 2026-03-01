/**
 * Error codes for the hierarchical authentication and authorization system
 * Organized by category for easy identification and handling
 */

/**
 * Authentication error codes (AUTH_*)
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'AUTH_ACCOUNT_INACTIVE',
  TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  TOKEN_REVOKED = 'AUTH_TOKEN_REVOKED',
  SESSION_NOT_FOUND = 'AUTH_SESSION_NOT_FOUND',
}

/**
 * Authorization error codes (AUTHZ_*)
 */
export enum AuthzErrorCode {
  INSUFFICIENT_HIERARCHY = 'AUTHZ_INSUFFICIENT_HIERARCHY',
  PERMISSION_DENIED = 'AUTHZ_PERMISSION_DENIED',
  OUT_OF_SCOPE = 'AUTHZ_OUT_OF_SCOPE',
  REQUIRES_APPROVAL = 'AUTHZ_REQUIRES_APPROVAL',
  SELF_APPROVAL_DENIED = 'AUTHZ_SELF_APPROVAL_DENIED',
}

/**
 * Permission error codes (PERM_*)
 */
export enum PermErrorCode {
  GOLDEN_RULE_VIOLATION = 'PERM_GOLDEN_RULE_VIOLATION',
  NOT_SUBORDINATE = 'PERM_NOT_SUBORDINATE',
  ALREADY_GRANTED = 'PERM_ALREADY_GRANTED',
  NOT_FOUND = 'PERM_NOT_FOUND',
}

/**
 * User error codes (USER_*)
 */
export enum UserErrorCode {
  NOT_FOUND = 'USER_NOT_FOUND',
  ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_HIERARCHY = 'USER_INVALID_HIERARCHY',
  CANNOT_CREATE_LEVEL = 'USER_CANNOT_CREATE_LEVEL',
}

/**
 * Organization error codes (ORG_*)
 */
export enum OrgErrorCode {
  NOT_FOUND = 'ORG_NOT_FOUND',
  NAME_TAKEN = 'ORG_NAME_TAKEN',
  INACTIVE = 'ORG_INACTIVE',
}

/**
 * Validation error codes (VAL_*)
 */
export enum ValidationErrorCode {
  INVALID_INPUT = 'VAL_INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'VAL_MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'VAL_INVALID_FORMAT',
}

/**
 * System error codes (SYS_*)
 */
export enum SystemErrorCode {
  DATABASE_ERROR = 'SYS_DATABASE_ERROR',
  CACHE_ERROR = 'SYS_CACHE_ERROR',
  TRANSACTION_FAILED = 'SYS_TRANSACTION_FAILED',
}

/**
 * Combined error code type for type safety
 */
export type ErrorCode =
  | AuthErrorCode
  | AuthzErrorCode
  | PermErrorCode
  | UserErrorCode
  | OrgErrorCode
  | ValidationErrorCode
  | SystemErrorCode;
