import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthResolver } from './resolvers/health.resolver';
import { DatabaseHealthIndicator } from '../../health/indicators/database.health';
import { RedisHealthIndicator } from '../../health/indicators/redis.health';

describe('GraphQL API Layer', () => {
  let healthResolver: HealthResolver;
  let healthCheckService: HealthCheckService;
  let databaseHealth: DatabaseHealthIndicator;
  let redisHealth: RedisHealthIndicator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthResolver,
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: DatabaseHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: RedisHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
      ],
    }).compile();

    healthResolver = module.get<HealthResolver>(HealthResolver);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    databaseHealth = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
    redisHealth = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  describe('HealthResolver', () => {
    it('should be defined', () => {
      expect(healthResolver).toBeDefined();
    });

    it('should return healthy status when all services are healthy', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          cache: { status: 'up' },
          queue: { status: 'up' },
        },
        error: {},
        details: {},
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockHealthResult);

      const result = await healthResolver.health();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.database.status).toBe('up');
      expect(result.cache.status).toBe('up');
      expect(result.queue.status).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when health check fails', async () => {
      jest.spyOn(healthCheckService, 'check').mockRejectedValue(new Error('Health check failed'));

      const result = await healthResolver.health();

      expect(result.status).toBe('error');
      expect(result.database.status).toBe('down');
      expect(result.cache.status).toBe('down');
      expect(result.queue.status).toBe('down');
    });

    it('should handle missing service info gracefully', async () => {
      const mockHealthResult = {
        status: 'ok',
        info: {},
        error: {},
        details: {},
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockHealthResult);

      const result = await healthResolver.health();

      expect(result.database.status).toBe('unknown');
      expect(result.cache.status).toBe('unknown');
      expect(result.queue.status).toBe('unknown');
    });
  });
});
