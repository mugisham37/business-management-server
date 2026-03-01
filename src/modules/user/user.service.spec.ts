import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../core/database/prisma.service';
import { HierarchyLevel, UserStatus } from '@prisma/client';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            users: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            staff_profiles: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUserCreation', () => {
    it('should throw ForbiddenException when worker tries to create user', async () => {
      const creator = { hierarchyLevel: HierarchyLevel.WORKER };
      
      await expect(
        service.validateUserCreation(creator, HierarchyLevel.WORKER)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when manager tries to create manager', async () => {
      const creator = { hierarchyLevel: HierarchyLevel.MANAGER };
      
      await expect(
        service.validateUserCreation(creator, HierarchyLevel.MANAGER)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to create manager', async () => {
      const creator = { hierarchyLevel: HierarchyLevel.OWNER };
      
      await expect(
        service.validateUserCreation(creator, HierarchyLevel.MANAGER)
      ).resolves.not.toThrow();
    });

    it('should allow manager to create worker', async () => {
      const creator = { hierarchyLevel: HierarchyLevel.MANAGER };
      
      await expect(
        service.validateUserCreation(creator, HierarchyLevel.WORKER)
      ).resolves.not.toThrow();
    });
  });

  describe('findById', () => {
    it('should return user with relations', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        hierarchyLevel: HierarchyLevel.MANAGER,
      };

      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.findById(userId);
      expect(result).toEqual(mockUser);
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          staff_profiles: true,
          branches: true,
          departments: true,
        },
      });
    });
  });

  describe('findByEmailAndOrg', () => {
    it('should return user by email and organization', async () => {
      const email = 'test@example.com';
      const organizationId = 'org-123';
      const mockUser = {
        id: 'user-123',
        email,
        organizationId,
      };

      jest.spyOn(prisma.users, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await service.findByEmailAndOrg(email, organizationId);
      expect(result).toEqual(mockUser);
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: {
          email_organizationId: {
            email,
            organizationId,
          },
        },
        include: {
          staff_profiles: true,
        },
      });
    });
  });

  describe('changePassword', () => {
    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        service.changePassword('user-123', 'oldPass', 'NewPass123!')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user has no password', async () => {
      const mockUser = {
        id: 'user-123',
        passwordHash: null,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);

      await expect(
        service.changePassword('user-123', 'oldPass', 'NewPass123!')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        passwordHash: 'hashed_password',
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);

      await expect(
        service.changePassword('user-123', 'wrongPass', 'NewPass123!')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for weak password', async () => {
      const bcrypt = require('bcrypt');
      const mockUser = {
        id: 'user-123',
        passwordHash: await bcrypt.hash('OldPass123!', 10),
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);

      await expect(
        service.changePassword('user-123', 'OldPass123!', 'weak')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setPIN', () => {
    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        service.setPIN('user-123', '1234')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not a worker', async () => {
      const mockUser = {
        id: 'user-123',
        hierarchyLevel: HierarchyLevel.MANAGER,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);

      await expect(
        service.setPIN('user-123', '1234')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid PIN format', async () => {
      const mockUser = {
        id: 'user-123',
        hierarchyLevel: HierarchyLevel.WORKER,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);

      await expect(
        service.setPIN('user-123', '12')
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.setPIN('user-123', '1234567')
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.setPIN('user-123', 'abcd')
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully set PIN for worker', async () => {
      const mockUser = {
        id: 'user-123',
        hierarchyLevel: HierarchyLevel.WORKER,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.users, 'update').mockResolvedValue(mockUser as any);

      await expect(
        service.setPIN('user-123', '1234')
      ).resolves.not.toThrow();

      expect(prisma.users.update).toHaveBeenCalled();
    });
  });
});
