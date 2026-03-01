import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserContext } from '../../../common/types/user-context.type';

/**
 * CurrentUser Decorator
 * Extracts user context from request (supports both REST and GraphQL)
 * 
 * @example
 * ```typescript
 * @Query(() => User)
 * async getProfile(@CurrentUser() user: UserContext) {
 *   return this.userService.findById(user.userId);
 * }
 * 
 * // Extract specific field
 * @Query(() => String)
 * async getUserId(@CurrentUser('userId') userId: string) {
 *   return userId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, context: ExecutionContext): UserContext | any => {
    const request = getRequest(context);
    const user: UserContext = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);

/**
 * Get request from execution context (supports both REST and GraphQL)
 */
function getRequest(context: ExecutionContext): any {
  const type = context.getType();

  if (type === 'http') {
    return context.switchToHttp().getRequest();
  }

  // GraphQL context
  const ctx = GqlExecutionContext.create(context);
  return ctx.getContext().req;
}
