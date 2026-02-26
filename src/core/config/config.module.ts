import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { configValidationSchema } from './validation.schema';
import databaseConfig from './env/database.config';
import cacheConfig from './env/cache.config';
import queueConfig from './env/queue.config';
import apiConfig from './env/api.config';
import { ConfigService } from './config.service';

/**
 * Global configuration module
 * Loads and validates environment variables on application startup
 * Provides type-safe configuration access throughout the application
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig, cacheConfig, queueConfig, apiConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      cache: true,
      expandVariables: true,
    }),
  ],
  providers: [ConfigService],
  exports: [NestConfigModule, ConfigService],
})
export class ConfigModule {}
