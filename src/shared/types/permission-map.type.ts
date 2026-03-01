/**
 * Permission map structure
 * Maps module names to arrays of allowed actions
 * Example: { "sales": ["create", "read", "update"], "inventory": ["read"] }
 */
export type PermissionMap = Record<string, string[]>;
