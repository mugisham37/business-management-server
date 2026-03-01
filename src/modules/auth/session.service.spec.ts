import { Test, TestingModule } from '@nestjs/testing';
import { SessionService, CreateSessionDto } from './session.service';
import { PrismaService } from '../../core/database/prisma.service';
import * as bcrypt from 'bcrypt';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: PrismaService;

  const mockPrismaService = {
    sessions: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with hashed refresh token', async () => {
      const dto: CreateSessionDto = {
        userId: 'user-123',
        refreshToken: 'plain-refresh-token',
        accessTokenFingerprint: 'fingerprint-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockSession = {
        id: 'session-123',
        userId: dto.userId,
        refreshTokenHash: 'hashed-token',
        accessTokenFingerprint: dto.accessTokenFingerprint,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        expiresAt: dto.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.sessions.create.mockResolvedValue(mockSession);

      const result = await service.createSession(dto);

      expect(result).toEqual(mockSession);
      expect(mockPrismaService.sessions.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: dto.userId,
          accessTokenFingerprint: dto.accessTokenFingerprint,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
          expiresAt: dto.expiresAt,
        }),
      });

      // Verify refresh token was hashed
      const createCall = mockPrismaService.sessions.create.mock.calls[0][0];
      expect(createCall.data.refreshTokenHash).toBeDefined();
      expect(createCall.data.refreshTokenHash).not.toBe(dto.refreshToken);
    });
  });

  describe('findByRefreshToken', () => {
    it('should find session with matching refresh token hash', async () => {
      const plainToken = 'plain-refresh-token';
      const hashedToken = await bcrypt.hash(plainToken, 10);

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        refreshTokenHash: hashedToken,
        accessTokenFingerprint: 'fingerprint-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.sessions.findMany.mockResolvedValue([mockSession]);

      const result = await service.findByRefreshToken(plainToken);

      expect(result).toEqual(mockSession);
      expect(mockPrismaService.sessions.findMany).toHaveBeenCalledWith({
        where: {
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it('should return null if no matching session found', async () => {
      mockPrismaService.sessions.findMany.mockResolvedValue([]);

      const result = await service.findByRefreshToken('non-existent-token');

      expect(result).toBeNull();
    });

    it('should return null if refresh token does not match any hash', async () => {
      const hashedToken = await bcrypt.hash('different-token', 10);

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        refreshTokenHash: hashedToken,
        accessTokenFingerprint: 'fingerprint-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.sessions.findMany.mockResolvedValue([mockSession]);

      const result = await service.findByRefreshToken('wrong-token');

      expect(result).toBeNull();
    });

    it('should exclude revoked sessions', async () => {
      mockPrismaService.sessions.findMany.mockResolvedValue([]);

      await service.findByRefreshToken('some-token');

      expect(mockPrismaService.sessions.findMany).toHaveBeenCalledWith({
        where: {
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it('should exclude expired sessions', async () => {
      const now = new Date();
      mockPrismaService.sessions.findMany.mockResolvedValue([]);

      await service.findByRefreshToken('some-token');

      const callArgs = mockPrismaService.sessions.findMany.mock.calls[0][0];
      expect(callArgs.where.expiresAt.gt).toBeInstanceOf(Date);
      expect(callArgs.where.expiresAt.gt.getTime()).toBeLessThanOrEqual(
        now.getTime() + 1000,
      );
    });
  });

  describe('revokeSession', () => {
    it('should set revokedAt timestamp on session', async () => {
      const sessionId = 'session-123';

      mockPrismaService.sessions.update.mockResolvedValue({
        id: sessionId,
        revokedAt: new Date(),
      });

      await service.revokeSession(sessionId);

      expect(mockPrismaService.sessions.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for a user', async () => {
      const userId = 'user-123';

      mockPrismaService.sessions.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserSessions(userId);

      expect(mockPrismaService.sessions.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should exclude specified session when revoking', async () => {
      const userId = 'user-123';
      const exceptSessionId = 'session-current';

      mockPrismaService.sessions.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeAllUserSessions(userId, exceptSessionId);

      expect(mockPrismaService.sessions.updateMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
          id: {
            not: exceptSessionId,
          },
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const userId = 'user-123';

      mockPrismaService.sessions.updateMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.revokeAllUserSessions(userId)).rejects.toThrow(
        'Failed to revoke sessions',
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          userId,
          refreshTokenHash: 'hash-1',
          accessTokenFingerprint: 'fp-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: null,
          createdAt: new Date(),
        },
        {
          id: 'session-2',
          userId,
          refreshTokenHash: 'hash-2',
          accessTokenFingerprint: 'fp-2',
          ipAddress: '192.168.1.2',
          userAgent: 'Chrome/90.0',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: null,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.sessions.findMany.mockResolvedValue(mockSessions);

      const result = await service.getActiveSessions(userId);

      expect(result).toEqual(mockSessions);
      expect(mockPrismaService.sessions.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array if no active sessions', async () => {
      const userId = 'user-123';

      mockPrismaService.sessions.findMany.mockResolvedValue([]);

      const result = await service.getActiveSessions(userId);

      expect(result).toEqual([]);
    });
  });
});
