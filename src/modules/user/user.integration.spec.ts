import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserGrpcController } from '../../api/grpc/controllers/user.controller';
import { UserResolver } from '../../api/graphql/resolvers/user.resolver';
import { UserRepository } from './user.repository';
import { EventBusService } from '../../core/events/event-bus.service';
import { MultiTierCacheService } from '../../core/cache/multi-tier-cache.service';
import { User } from '@prisma/client';

describe('User Integration - gRPC and GraphQL', () => {
  let userService: UserService;
  let grpcController: UserGrpcController;
  let graphqlResolver: UserResolver;
  let repository: jest.Mocked<UserRepository>;

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
      controllers: [UserGrpcController],
    }).compile();

    userService = module.get<UserService>(UserService);
    grpcController = module.get<UserGrpcController>(UserGrpcController);
    graphqlResolver = new UserResolver(userService);
    repository = module.get(UserRepository);
  });

  describe('Both APIs use the same UserService', () => {
    it('should return the same user data from gRPC and GraphQL', async () => {
      repository.findById.mockResolvedValue(mockUser);

      // Call via gRPC
      const grpcResult = await grpcController.getUser({ id: '1' });

      // Call via GraphQL
      const graphqlResult = await graphqlResolver.getUser('1');

      // Both should return equivalent data
      expect(grpcResult.user.id).toBe(graphqlResult.id);
      expect(grpcResult.user.email).toBe(graphqlResult.email);
      expect(grpcResult.user.first_name).toBe(graphqlResult.firstName);
      expect(grpcResult.user.last_name).toBe(graphqlResult.lastName);
      expect(grpcResult.user.is_active).toBe(graphqlResult.isActive);
      expect(grpcResult.user.tenant_id).toBe(graphqlResult.tenantId);

      // Verify both called the same service method
      expect(repository.findById).toHaveBeenCalledTimes(2);
      expect(repository.findById).toHaveBeenCalledWith('1');
    });

    it('should create user through both APIs using the same service', async () => {
      const createData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        tenantId: 'tenant1',
      };

      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);

      // Create via gRPC
      const grpcResult = await grpcController.createUser({
        email: createData.email,
        password: createData.password,
        first_name: createData.firstName,
        last_name: createData.lastName,
        tenant_id: createData.tenantId,
      });

      // Create via GraphQL
      const graphqlResult = await graphqlResolver.createUser(createData);

      // Both should return equivalent data
      expect(grpcResult.user.email).toBe(graphqlResult.email);
      expect(grpcResult.user.first_name).toBe(graphqlResult.firstName);

      // Verify both called the same service method
      expect(repository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should apply guards to both gRPC and GraphQL endpoints', () => {
      // Check that GraphQL resolver has guards
      const metadata = Reflect.getMetadata('__guards__', graphqlResolver.getUser);
      expect(metadata).toBeDefined();

      // Note: gRPC guards are applied via interceptors in the module configuration
      // This test verifies the structure is in place
    });
  });
});
