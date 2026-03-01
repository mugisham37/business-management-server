import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from '../token.service';
import { HierarchyLevel } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let tokenService: TokenService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      return null;
    }),
  };

  const mockTokenService = {
    isTokenBlacklisted: jest.fn(),
    verifyPermissionFingerprint: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const validPayload = {
      jti: 'token-id-123',
      userId: 'user-123',
      organizationId: 'org-123',
      hierarchyLevel: HierarchyLevel.MANAGER,
      branchId: 'branch-123',
      departmentId: 'dept-123',
      permissionFingerprint: 'fingerprint-123',
      email: 'test@example.com',
    };

    it('should return user context when token is valid', async () => {
      mockTokenService.isTokenBlacklisted.mockResolvedValue(false);
      mockTokenService.verifyPermissionFingerprint.mockResolvedValue(true);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual({
        userId: validPayload.userId,
        organizationId: validPayload.organizationId,
        hierarchyLevel: validPayload.hierarchyLevel,
        branchId: validPayload.branchId,
        departmentId: validPayload.departmentId,
        permissionFingerprint: validPayload.permissionFingerprint,
        email: validPayload.email,
      });
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validPayload.jti);
      expect(tokenService.verifyPermissionFingerprint).toHaveBeenCalledWith(
        validPayload.userId,
        validPayload.permissionFingerprint,
      );
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      mockTokenService.isTokenBlacklisted.mockResolvedValue(true);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        new UnauthorizedException('Token has been revoked'),
      );
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validPayload.jti);
      expect(tokenService.verifyPermissionFingerprint).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when permission fingerprint does not match', async () => {
      mockTokenService.isTokenBlacklisted.mockResolvedValue(false);
      mockTokenService.verifyPermissionFingerprint.mockResolvedValue(false);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        new UnauthorizedException('Permission fingerprint mismatch - please re-authenticate'),
      );
      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith(validPayload.jti);
      expect(tokenService.verifyPermissionFingerprint).toHaveBeenCalledWith(
        validPayload.userId,
        validPayload.permissionFingerprint,
      );
    });
  });

  describe('constructor', () => {
    it('should throw error when JWT_SECRET is not configured', () => {
      const badConfigService = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new JwtStrategy(badConfigService as any, mockTokenService as any);
      }).toThrow('JWT_SECRET is not configured');
    });
  });
});
