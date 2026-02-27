import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './controllers/health.controller';
import { PrismaService } from '../../core/database/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { ServingStatus, ComponentHealthStatus } from './interfaces';

describe('gRPC API Layer', () => {
  let healthController: HealthController;
  let prismaService: PrismaService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              ping: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('HealthController', () => {
    it('should be defined', () => {
      expect(healthController).toBeDefined();
    });

    it('should return healthy status when all components are healthy', async () => {
      const result = await healthController.check({});

      expect(result).toBeDefined();
      expect(result.status).toBe(ServingStatus.SERVING);
      expect(result.components).toBeDefined();
      expect(result.components?.database).toBeDefined();
      expect(result.components?.cache).toBeDefined();
      expect(result.components?.queue).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return not serving status when database is unhealthy', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockRejectedValue(new Error('Connection failed'));

      const result = await healthController.check({});

      expect(result.status).toBe(ServingStatus.NOT_SERVING);
      expect(result.components?.database.status).toBe(ComponentHealthStatus.UNHEALTHY);
    });

    it('should return not serving status when cache is unhealthy', async () => {
      const mockClient = {
        ping: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };
      jest.spyOn(redisService, 'getClient').mockReturnValue(mockClient as any);

      const result = await healthController.check({});

      expect(result.status).toBe(ServingStatus.NOT_SERVING);
      expect(result.components?.cache.status).toBe(ComponentHealthStatus.UNHEALTHY);
    });
  });
});
