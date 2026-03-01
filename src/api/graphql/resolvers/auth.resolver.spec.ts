import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from '../../../modules/auth/auth.service';
import { UserService } from '../../../modules/user/user.service';
import { SessionService } from '../../../modules/auth/session.service';

describe('AuthResolver - Session Management', () => {
  let resolver: AuthResolver;
  let sessionService: SessionService;

  const mockAuthService = {
    registerOwner: jest.fn(),
    loginWithPassword: jest.fn(),
    loginWithPin: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
  };

  const mockUserService = {
    changePassword: jest.fn(),
  };

  const mockSessionService = {
    getActiveSessions: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllUserSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for current user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash',
          accessTokenFingerprint: 'fingerprint',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          expiresAt: new Date('2026-03-03'),
          revokedAt: null,
          createdAt: new Date('2026-03-02'),
        },
        {
          id: 'session-2',
          userId: 'user-1',
          refreshTokenHash: 'hash2',
          accessTokenFingerprint: 'fingerprint2',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          expiresAt: new Date('2026-03-03'),
          revokedAt: null,
          createdAt: new Date('2026-03-02'),
        },
      ];

      mockSessionService.getActiveSessions.mockResolvedValue(mockSessions);

      const currentUser = { userId: 'user-1' };
      const result = await resolver.getActiveSessions(currentUser);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'session-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: mockSessions[0].createdAt,
        expiresAt: mockSessions[0].expiresAt,
      });
      expect(sessionService.getActiveSessions).toHaveBeenCalledWith('user-1');
    });

    it('should handle null ipAddress and userAgent', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash',
          accessTokenFingerprint: 'fingerprint',
          ipAddress: null,
          userAgent: null,
          expiresAt: new Date('2026-03-03'),
          revokedAt: null,
          createdAt: new Date('2026-03-02'),
        },
      ];

      mockSessionService.getActiveSessions.mockResolvedValue(mockSessions);

      const currentUser = { userId: 'user-1' };
      const result = await resolver.getActiveSessions(currentUser);

      expect(result[0].ipAddress).toBe('unknown');
      expect(result[0].userAgent).toBe('unknown');
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash',
          accessTokenFingerprint: 'fingerprint',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          expiresAt: new Date('2026-03-03'),
          revokedAt: null,
          createdAt: new Date('2026-03-02'),
        },
      ];

      mockSessionService.getActiveSessions.mockResolvedValue(mockSessions);
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      const currentUser = { userId: 'user-1' };
      const input = { sessionId: 'session-1' };
      const result = await resolver.revokeSession(input, currentUser);

      expect(result).toBe(true);
      expect(sessionService.revokeSession).toHaveBeenCalledWith('session-1');
    });

    it('should throw error if session does not belong to user', async () => {
      mockSessionService.getActiveSessions.mockResolvedValue([]);

      const currentUser = { userId: 'user-1' };
      const input = { sessionId: 'session-999' };

      await expect(resolver.revokeSession(input, currentUser)).rejects.toThrow(
        'Session not found or already revoked',
      );
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      mockSessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      const currentUser = { userId: 'user-1', sessionId: 'current-session' };
      const result = await resolver.revokeAllSessions(currentUser);

      expect(result).toBe(true);
      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-1',
        'current-session',
      );
    });

    it('should handle missing sessionId', async () => {
      mockSessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      const currentUser = { userId: 'user-1' };
      const result = await resolver.revokeAllSessions(currentUser);

      expect(result).toBe(true);
      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
        'user-1',
        '',
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token and return new tokens', async () => {
      const mockAuthResponse = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          hierarchyLevel: 'OWNER',
          organizationId: 'org-1',
        },
        expiresIn: 900,
      };

      mockAuthService.refreshToken.mockResolvedValue(mockAuthResponse);

      const input = { refreshToken: 'old-refresh-token' };
      const context = { req: {} };
      const result = await resolver.refreshToken(input, context);

      expect(result).toEqual(mockAuthResponse);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
    });

    it('should throw error for invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Invalid or expired refresh token'),
      );

      const input = { refreshToken: 'invalid-token' };
      const context = { req: {} };

      await expect(resolver.refreshToken(input, context)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });
});
