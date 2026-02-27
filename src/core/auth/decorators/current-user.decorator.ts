import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../interfaces';

/**
 * CurrentUser Decorator
 * Extracts user context from request object
 * @returns User context from authenticated request
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: UserContext = request.user;

    return data ? user?.[data] : user;
  },
);
