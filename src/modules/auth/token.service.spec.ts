import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RedisService } from '../../core/cache/redis.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionSet } from '../../common/types/permission.type';
import type { users, HierarchyLevel } from '@prisma/client';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let prismaService: PrismaService;

  const mockUser: users = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: null,
    pinHash: null,
    googleId: null,
    organizationId: 'org-123',
    hierarchyLevel: 'OWNER' as HierarchyLevel,
    status: 'ACTIVE',
    createdById: null,
    branchId: null,
    departmentId: null,
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    tenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy_legacy: null,
    updatedBy: null,
  };

  const mockPermissions: PermissionSet = {
    modules: new Map([
      ['INVENTORY', ['CREATE', 'READ', 'UPDATE']],
      ['SALES', ['READ']],
    ]),
    fingerprint: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_SECRET: 'test-secret-key-min-32-characters-long',
                JWT_ACCESS_TOKEN_EXPIRY_SECONDS: 900,
                JWT_REFRESH_TOKEN_EXPIRY_SECONDS: 604800,
              };
              return config[key];
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            exists: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            permission_matrices: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn(),
            logWithMetadata: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with user context and permission fingerprint', async () => {
      const mockToken = 'mock.jwt.token';
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const token = await service.generateAccessToken(mockUser, mockPermissions);

      expect(token).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          organizationId: mockUser.organizationId,
          hierarchyLevel: mockUser.hierarchyLevel,
          branchId: mockUser.branchId,
          departmentId: mockUser.departmentId,
          email: mockUser.email,
          permissionFingerprint: expect.any(String),
          jti: expect.any(String),
        }),
        expect.objectContaining({
          secret: 'test-secret-key-min-32-characters-long',
          expiresIn: 900,
        }),
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate cryptographically random refresh token', async () => {
      const token = await service.generateRefreshToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
    });

    it('should generate unique tokens on multiple calls', async () => {
      const token1 = await service.generateRefreshToken();
      const token2 = await service.generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('calculatePermissionFingerprint', () => {
    it('should calculate SHA-256 hash of permissions', () => {
      const fingerprint = service.calculatePermissionFingerprint(mockPermissions);

      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce same fingerprint for same permissions', () => {
      const fingerprint1 = service.calculatePermissionFingerprint(mockPermissions);
      const fingerprint2 = service.calculatePermissionFingerprint(mockPermissions);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should produce different fingerprints for different permissions', () => {
      const permissions1: PermissionSet = {
        modules: new Map([['INVENTORY', ['CREATE', 'READ']]]),
        fingerprint: '',
      };

      const permissions2: PermissionSet = {
        modules: new Map([['INVENTORY', ['CREATE', 'READ', 'UPDATE']]]),
        fingerprint: '',
      };

      const fingerprint1 = service.calculatePermissionFingerprint(permissions1);
      const fingerprint2 = service.calculatePermissionFingerprint(permissions2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should produce same fingerprint regardless of module order', () => {
      const permissions1: PermissionSet = {
        modules: new Map([
          ['INVENTORY', ['CREATE', 'READ']],
          ['SALES', ['READ']],
        ]),
        fingerprint: '',
      };

      const permissions2: PermissionSet = {
        modules: new Map([
          ['SALES', ['READ']],
          ['INVENTORY', ['CREATE', 'READ']],
        ]),
        fingerprint: '',
      };

      const fingerprint1 = service.calculatePermissionFingerprint(permissions1);
      const fingerprint2 = service.calculatePermissionFingerprint(permissions2);

      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('verifyPermissionFingerprint', () => {
    it('should return true when fingerprint matches current permissions', async () => {
      const fingerprint = service.calculatePermissionFingerprint(mockPermissions);

      jest.spyOn(prismaService.permission_matrices, 'findMany').mockResolvedValue([
        {
          id: 'pm-1',
          userId: 'user-123',
          organizationId: 'org-123',
          module: 'INVENTORY',
          actions: ['CREATE', 'READ', 'UPDATE'],
          grantedById: 'owner-123',
          grantedAt: new Date(),
          revokedAt: null,
        },
        {
          id: 'pm-2',
          userId: 'user-123',
          organizationId: 'org-123',
          module: 'SALES',
          actions: ['READ'],
          grantedById: 'owner-123',
          grantedAt: new Date(),
          revokedAt: null,
        },
      ]);

      const isValid = await service.verifyPermissionFingerprint('user-123', fingerprint);

      expect(isValid).toBe(true);
    });

    it('should return false when fingerprint does not match', async () => {
      const oldFingerprint = service.calculatePermissionFingerprint(mockPermissions);

      // Return different permissions from database
      jest.spyOn(prismaService.permission_matrices, 'findMany').mockResolvedValue([
        {
          id: 'pm-1',
          userId: 'user-123',
          organizationId: 'org-123',
          module: 'INVENTORY',
          actions: ['CREATE', 'READ'], // Different actions
          grantedById: 'owner-123',
          grantedAt: new Date(),
          revokedAt: null,
        },
      ]);

      const isValid = await service.verifyPermissionFingerprint('user-123', oldFingerprint);

      expect(isValid).toBe(false);
    });
  });

  describe('revokeToken', () => {
    it('should add token JTI to Redis blacklist with TTL', async () => {
      const mockToken = 'mock.jwt.token';
      const mockPayload = {
        userId: 'user-123',
        jti: 'token-jti-123',
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockPayload);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      await service.revokeToken(mockToken);

      expect(redisService.set).toHaveBeenCalledWith(
        'token:blacklist:token-jti-123',
        true,
        expect.any(Number),
      );
    });

    it('should not add expired token to blacklist', async () => {
      const mockToken = 'mock.jwt.token';
      const mockPayload = {
        userId: 'user-123',
        jti: 'token-jti-123',
        exp: Math.floor(Date.now() / 1000) - 100, // Expired 100 seconds ago
      };

      jest.spyOn(jwtService, 'decode').mockReturnValue(mockPayload);
      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      await service.revokeToken(mockToken);

      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate token and return payload when valid', async () => {
      const mockPayload = {
        userId: 'user-123',
        organizationId: 'org-123',
        hierarchyLevel: 'OWNER',
        branchId: null,
        departmentId: null,
        permissionFingerprint: 'valid-fingerprint',
        email: 'test@example.com',
        jti: 'token-jti-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);
      jest.spyOn(redisService, 'exists').mockResolvedValue(false);
      jest.spyOn(prismaService.permission_matrices, 'findMany').mockResolvedValue([]);
      jest.spyOn(service, 'calculatePermissionFingerprint').mockReturnValue('valid-fingerprint');

      const payload = await service.validateAccessToken('mock.jwt.token');

      expect(payload).toEqual(mockPayload);
    });

    it('should throw error when token is blacklisted', async () => {
      const mockPayload = {
        userId: 'user-123',
        jti: 'token-jti-123',
        permissionFingerprint: 'fingerprint',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);
      jest.spyOn(redisService, 'exists').mockResolvedValue(true);

      await expect(service.validateAccessToken('mock.jwt.token')).rejects.toThrow(
        'Token has been revoked',
      );
    });

    it('should throw error when permission fingerprint does not match', async () => {
      const mockPayload = {
        userId: 'user-123',
        jti: 'token-jti-123',
        permissionFingerprint: 'old-fingerprint',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);
      jest.spyOn(redisService, 'exists').mockResolvedValue(false);
      jest.spyOn(service, 'verifyPermissionFingerprint').mockResolvedValue(false);

      await expect(service.validateAccessToken('mock.jwt.token')).rejects.toThrow(
        'Permission fingerprint mismatch',
      );
    });
  });
});
