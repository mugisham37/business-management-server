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
});
