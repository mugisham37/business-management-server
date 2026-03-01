import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './core/logging/logging.module';
import { ContextModule } from './core/context/context.module';
import { RequestContextInterceptor } from './core/context/request-context.interceptor';
import { HealthModule } from './health/health.module';
import { GrpcModule } from './api/grpc/grpc.module';
import { GraphQLModule } from './api/graphql/graphql.module';
import { CorrelationIdMiddleware } from './core/logging/correlation-id.middleware';
import { SanitizationMiddleware } from './common/middleware/sanitization.middleware';
import { ResilienceModule } from './core/resilience';

@Module({
  imports: [
    LoggingModule,
    ContextModule,
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
    SanitizationMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, SanitizationMiddleware)
      .forRoutes('*');
  }
}
