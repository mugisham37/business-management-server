// TypeScript interfaces for authorization.proto

export enum HierarchyLevel {
  HIERARCHY_LEVEL_UNSPECIFIED = 0,
  OWNER = 1,
  MANAGER = 2,
  WORKER = 3,
}

export interface ResourceScope {
  branch_id?: string;
  department_id?: string;
}

export interface TransactionContext {
  transaction_type: string;
  amount: number;
}

export interface CheckPermissionRequest {
  user_id: string;
  module: string;
  action: string;
  resource_id?: string;
  resource_scope?: ResourceScope;
  transaction_context?: TransactionContext;
  trace_metadata?: Record<string, string>;
}

export interface CheckPermissionResponse {
  authorized: boolean;
  failed_layer?: string;
  reason?: string;
  requires_approval: boolean;
  approver_level?: HierarchyLevel;
  trace_metadata?: Record<string, string>;
}

export interface ValidateTokenRequest {
  access_token: string;
  trace_metadata?: Record<string, string>;
}

export interface UserIdentity {
  user_id: string;
  organization_id: string;
  hierarchy_level: HierarchyLevel;
  branch_id?: string;
  department_id?: string;
  permission_fingerprint: string;
  email: string;
  issued_at: number;
  expires_at: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user_identity?: UserIdentity;
  error_code?: string;
  error_message?: string;
  trace_metadata?: Record<string, string>;
}

export interface GetUserPermissionsRequest {
  user_id: string;
  trace_metadata?: Record<string, string>;
}

export interface ModulePermission {
  module: string;
  actions: string[];
}

export interface GetUserPermissionsResponse {
  permissions: ModulePermission[];
  permission_fingerprint: string;
  trace_metadata?: Record<string, string>;
}
