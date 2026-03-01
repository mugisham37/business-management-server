import { HierarchyLevel } from '@prisma/client';
import { ResourceScope } from './permission.type';

/**
 * Authorization-related types
 */

/**
 * Transaction context for business rules evaluation
 */
export interface TransactionContext {
  transactionType: string;
  amount: number;
}

/**
 * Authorization context for permission checks
 */
export interface AuthorizationContext {
  userId: string;
  organizationId: string;
  hierarchyLevel: HierarchyLevel;
  branchId: string | null;
  departmentId: string | null;
  module: string;
  action: string;
  resourceId?: string;
  resourceScope?: ResourceScope;
  transactionContext?: TransactionContext;
}

/**
 * Authorization result from permission engine
 */
export interface AuthorizationResult {
  authorized: boolean;
  failedLayer?: string;
  reason?: string;
  requiresApproval?: boolean;
  approverLevel?: HierarchyLevel;
}

/**
 * Business rule evaluation result
 */
export interface BusinessRuleResult {
  passed: boolean;
  requiresApproval: boolean;
  approverLevel?: HierarchyLevel;
  matchedRuleId?: string;
}
