import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './core/logging/logging.module';
import { ContextModule } from './core/context/context.module';
import { CacheModule } from './core/cache/cache.module';
import { RequestContextInterceptor } from './core/context/request-context.interceptor';
import { HttpLoggingInterceptor } from './core/logging/interceptors/http-logging.interceptor';
import { HttpExceptionFilter } from './core/logging/filters/http-exception.filter';
import { GraphQLExceptionFilter } from './api/graphql/filters/graphql-exception.filter';
import { HealthModule } from './health/health.module';
import { GrpcModule } from './api/grpc/grpc.module';
import { GraphQLModule } from './api/graphql/graphql.module';
import { CorrelationIdMiddleware } from './core/logging/correlation-id.middleware';
import { SanitizationMiddleware } from './common/middleware/sanitization.middleware';
import { ResilienceModule } from './core/resilience';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggingModule,
    ContextModule,
    CacheModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: 0,
        ttl: configService.get<number>('CACHE_TTL', 3600),
        connectionTimeout: 10000,
        enableRetry: true,
        maxRetries: 10,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),
    ResilienceModule,
    HealthModule,
    GrpcModule,
    GraphQLModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: GraphQLExceptionFilter,
    },
    SanitizationMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CorrelationIdMiddleware to all routes
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
    
    // Apply SanitizationMiddleware to all routes EXCEPT GraphQL
    // GraphQL has its own validation and sanitization mechanisms
    consumer
      .apply(SanitizationMiddleware)
      .exclude('graphql')
      .forRoutes('*');
  }
}
