import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { UserContext } from '../../../core/auth/interfaces/user-context.interface';

/**
 * GraphQL CurrentUser Decorator
 * Extracts user context from GraphQL request
 */
export const GqlCurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const user: UserContext = request.user;

    return data ? user?.[data] : user;
  },
);
