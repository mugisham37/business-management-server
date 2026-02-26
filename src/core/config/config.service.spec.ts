import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import configuration from './configuration';
import { configValidationSchema } from './validation.schema';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    // Set required environment variables for testing
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_HOST = 'localhost';
    process.env.JWT_SECRET = 'test-secret-key-with-minimum-32-characters';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          load: [configuration],
          validationSchema: configValidationSchema,
          validationOptions: {
            allowUnknown: true,
            abortEarly: false,
          },
        }),
      ],
      providers: [ConfigService],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clean up hot-reload cache
    if (service) {
      service.clearHotReloadCache();
    }
  });

  describe('get', () => {
    it('should get configuration value', () => {
      const port = service.get<number>('PORT');
      expect(typeof port).toBe('number');
    });

    it('should return default value when key not found', () => {
      const value = service.get('NON_EXISTENT_KEY', 'default');
      expect(value).toBe('default');
    });

    it('should get nested configuration value', () => {
      const config = service.getAll();
      expect(config.database).toBeDefined();
      expect(config.cache).toBeDefined();
      expect(config.auth).toBeDefined();
    });
  });

  describe('isSensitive', () => {
    it('should identify sensitive keys', () => {
      expect(service.isSensitive('JWT_SECRET')).toBe(true);
      expect(service.isSensitive('DATABASE_URL')).toBe(true);
      expect(service.isSensitive('REDIS_PASSWORD')).toBe(true);
      expect(service.isSensitive('password')).toBe(true);
      expect(service.isSensitive('secret')).toBe(true);
    });

    it('should identify non-sensitive keys', () => {
      expect(service.isSensitive('PORT')).toBe(false);
      expect(service.isSensitive('NODE_ENV')).toBe(false);
      expect(service.isSensitive('LOG_LEVEL')).toBe(false);
    });
  });

  describe('maskValue', () => {
    it('should mask sensitive values', () => {
      const masked = service.maskValue('JWT_SECRET', 'my-secret-key-value');
      expect(masked).toBe('my-***lue');
      expect(masked).not.toContain('secret');
    });

    it('should not mask non-sensitive values', () => {
      const value = '3000';
      const masked = service.maskValue('PORT', value);
      expect(masked).toBe(value);
    });

    it('should handle short sensitive values', () => {
      const masked = service.maskValue('password', 'short');
      expect(masked).toBe('***');
    });

    it('should handle empty sensitive values', () => {
      const masked = service.maskValue('password', '');
      expect(masked).toBe('***');
    });
  });

  describe('getMasked', () => {
    it('should get masked sensitive value', () => {
      const masked = service.getMasked('JWT_SECRET');
      expect(masked).toContain('***');
      expect(masked).not.toContain('test-secret-key');
    });
  });

  describe('getAllMasked', () => {
    it('should mask all sensitive values in configuration', () => {
      const maskedConfig = service.getAllMasked();
      expect(maskedConfig).toBeDefined();
      expect(maskedConfig.auth.jwtSecret).toContain('***');
      // Database URL should be masked
      expect(typeof maskedConfig.database.url).toBe('string');
      if (maskedConfig.database.url) {
        expect(maskedConfig.database.url).toContain('***');
      }
    });
  });

  describe('hotReload', () => {
    it('should hot-reload supported configuration keys', () => {
      service.hotReload('LOG_LEVEL', 'debug');
      const logLevel = service.get('LOG_LEVEL');
      expect(logLevel).toBe('debug');
    });

    it('should throw error for non-hot-reloadable keys', () => {
      expect(() => {
        service.hotReload('DATABASE_URL', 'new-url');
      }).toThrow();
    });

    it('should validate hot-reloaded values', () => {
      expect(() => {
        service.hotReload('LOG_LEVEL', 'invalid-level');
      }).toThrow();
    });

    it('should validate numeric hot-reloaded values', () => {
      expect(() => {
        service.hotReload('CACHE_TTL', -1);
      }).toThrow();

      expect(() => {
        service.hotReload('CACHE_TTL', 'not-a-number' as any);
      }).toThrow();
    });

    it('should validate memory format hot-reloaded values', () => {
      expect(() => {
        service.hotReload('CACHE_MAX_MEMORY', 'invalid');
      }).toThrow();

      service.hotReload('CACHE_MAX_MEMORY', '200mb');
      expect(service.get('CACHE_MAX_MEMORY')).toBe('200mb');
    });

    it('should validate boolean hot-reloaded values', () => {
      expect(() => {
        service.hotReload('GRAPHQL_PLAYGROUND', 'not-a-boolean' as any);
      }).toThrow();

      service.hotReload('GRAPHQL_PLAYGROUND', false);
      expect(service.get('GRAPHQL_PLAYGROUND')).toBe(false);
    });
  });

  describe('getHotReloadableKeys', () => {
    it('should return list of hot-reloadable keys', () => {
      const keys = service.getHotReloadableKeys();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toContain('LOG_LEVEL');
      expect(keys).toContain('CACHE_TTL');
      expect(keys).toContain('GRAPHQL_PLAYGROUND');
    });
  });

  describe('clearHotReloadCache', () => {
    it('should clear specific key from cache', () => {
      service.hotReload('LOG_LEVEL', 'debug');
      expect(service.get('LOG_LEVEL')).toBe('debug');

      service.clearHotReloadCache('LOG_LEVEL');
      const logLevel = service.get('LOG_LEVEL');
      expect(logLevel).not.toBe('debug');
    });

    it('should clear all keys from cache', () => {
      service.hotReload('LOG_LEVEL', 'debug');
      service.hotReload('CACHE_TTL', 7200);

      service.clearHotReloadCache();

      const logLevel = service.get('LOG_LEVEL');
      const cacheTtl = service.get('CACHE_TTL');
      expect(logLevel).not.toBe('debug');
      expect(cacheTtl).not.toBe(7200);
    });
  });
});
