import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GqlAuthGuard } from './gql-auth.guard';
import { GqlRolesGuard } from './gql-roles.guard';
import { GqlPermissionsGuard } from './gql-permissions.guard';

describe('GraphQL Guards', () => {
  describe('GqlRolesGuard', () => {
    let guard: GqlRolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new GqlRolesGuard(reflector);
    });

    it('should allow access when no roles are required', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user has required role', () => {
      const context = createMockExecutionContext({
        user: { roles: ['admin'], permissions: [] },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when user does not have required role', () => {
      const context = createMockExecutionContext({
        user: { roles: ['user'], permissions: [] },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny access when user is not authenticated', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(guard.canActivate(context)).toBe(false);
    });
  });

  describe('GqlPermissionsGuard', () => {
    let guard: GqlPermissionsGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new GqlPermissionsGuard(reflector);
    });

    it('should allow access when no permissions are required', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user has all required permissions', () => {
      const context = createMockExecutionContext({
        user: { roles: [], permissions: ['read:users', 'write:users'] },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read:users', 'write:users']);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when user is missing a required permission', () => {
      const context = createMockExecutionContext({
        user: { roles: [], permissions: ['read:users'] },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read:users', 'write:users']);

      expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny access when user is not authenticated', () => {
      const context = createMockExecutionContext({});
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['read:users']);

      expect(guard.canActivate(context)).toBe(false);
    });
  });
});

function createMockExecutionContext(options: { user?: any } = {}): ExecutionContext {
  const mockRequest = {
    user: options.user,
  };

  return {
    getType: () => 'graphql',
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgs: () => [null, null, { req: mockRequest }, null],
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as any;
}
