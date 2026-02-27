import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { EventBusService } from '../../core/events/event-bus.service';
import { MultiTierCacheService } from '../../core/cache/multi-tier-cache.service';
import { User } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let cacheService: jest.Mocked<MultiTierCacheService>;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    tenantId: 'tenant1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findMany: jest.fn(),
      paginate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockEventBus = {
      publish: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockRepository },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: MultiTierCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get(UserRepository);
    eventBus = module.get(EventBusService);
    cacheService = module.get(MultiTierCacheService);
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(repository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new user and emit event', async () => {
      const createDto = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'tenant1',
      };

      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(result).toEqual(mockUser);
      expect(repository.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when email exists', async () => {
      const createDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'tenant1',
      };

      repository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a user and emit event', async () => {
      const updateDto = {
        firstName: 'Updated',
      };

      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({ ...mockUser, ...updateDto });

      const result = await service.update('1', updateDto);

      expect(result.firstName).toBe('Updated');
      expect(repository.update).toHaveBeenCalledWith('1', updateDto);
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a user and emit event', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue(mockUser);

      await service.delete('1');

      expect(repository.softDelete).toHaveBeenCalledWith('1');
      expect(eventBus.publish).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when user not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('1')).rejects.toThrow(NotFoundException);
    });
  });
});
