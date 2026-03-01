import { HierarchyLevel } from './hierarchy-level.enum';

/**
 * Layer where authorization failed
 */
export type AuthorizationLayer =
  | 'HIERARCHY'
  | 'PERMISSION'
  | 'SCOPE'
  | 'BUSINESS_RULE';

/**
 * Approval requirement details when business rules require approval
 */
export interface ApprovalRequirement {
  /** Required hierarchy level for the approver */
  requiredLevel: HierarchyLevel;

  /** Reason why approval is required */
  reason: string;

  /** ID of the authorization rule that triggered the requirement */
  ruleId: string;
}

/**
 * Result of an authorization check
 * Contains information about whether access is allowed and why
 */
export interface AuthorizationResult {
  /** Whether the authorization check passed */
  allowed: boolean;

  /** Reason for denial (if not allowed) */
  reason?: string;

  /** Which authorization layer failed (if not allowed) */
  layerFailed?: AuthorizationLayer;

  /** Whether the operation requires approval */
  requiresApproval?: boolean;

  /** Details about the approval requirement (if requiresApproval is true) */
  approvalRequirement?: ApprovalRequirement;
}
