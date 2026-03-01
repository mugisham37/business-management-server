import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserContext } from '../../../common/types/user-context.type';
import { TransactionContext } from '../../../common/types/authorization.type';
import { PermissionEngineService } from '../permission-engine.service';
import { LoggerService } from '../../../core/logging/logger.service';

/**
 * Business Rules Guard
 * Enforces transaction-based authorization rules using the Permission Engine (Layer 4)
 * Automatically extracts transaction context from resolver arguments
 * 
 * Requirements: 15.5
 */
@Injectable()
export class BusinessRulesGuard implements CanActivate {
  constructor(
    private readonly permissionEngine: PermissionEngineService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('BusinessRulesGuard');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract user context from GraphQL request
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    if (!user) {
      this.logger.logWithMetadata('warn', 'Business rules check failed: No user in context', {});
      throw new ForbiddenException('User not authenticated');
    }

    // Extract transaction context from resolver arguments
    const args = ctx.getArgs();
    const transactionContext = this.extractTransactionContext(args);

    // If no transaction context in arguments, allow (no business rules to check)
    if (!transactionContext) {
      return true;
    }

    // Check business rules using Permission Engine
    const result = await this.permissionEngine.checkBusinessRules({
      userId: user.userId,
      organizationId: user.organizationId,
      hierarchyLevel: user.hierarchyLevel,
      transactionContext,
    });

    if (!result.passed) {
      this.logger.logWithMetadata('warn', 'Business rules check failed', {
        userId: user.userId,
        transactionType: transactionContext.transactionType,
        amount: transactionContext.amount,
        requiresApproval: result.requiresApproval,
        approverLevel: result.approverLevel,
      });

      throw new ForbiddenException(
        `Transaction requires approval from ${result.approverLevel || 'higher level'}`,
      );
    }

    this.logger.logWithMetadata('debug', 'Business rules check passed', {
      userId: user.userId,
      transactionType: transactionContext.transactionType,
      amount: transactionContext.amount,
    });

    return true;
  }

  /**
   * Extract transaction context from resolver arguments
   * Looks for transactionType and amount in arguments
   */
  private extractTransactionContext(args: any): TransactionContext | null {
    let transactionType: string | undefined;
    let amount: number | undefined;

    // Check for transaction context in various argument structures
    if (args.transactionType && args.amount !== undefined) {
      transactionType = args.transactionType;
      amount = args.amount;
    } else if (args.input?.transactionType && args.input?.amount !== undefined) {
      transactionType = args.input.transactionType;
      amount = args.input.amount;
    } else if (args.data?.transactionType && args.data?.amount !== undefined) {
      transactionType = args.data.transactionType;
      amount = args.data.amount;
    } else if (args.transaction?.transactionType && args.transaction?.amount !== undefined) {
      transactionType = args.transaction.transactionType;
      amount = args.transaction.amount;
    }

    // Return null if transaction context not found
    if (!transactionType || amount === undefined) {
      return null;
    }

    return {
      transactionType,
      amount,
    };
  }
}
