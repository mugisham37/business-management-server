import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './core/logging/logging.module';
import { HealthModule } from './health/health.module';
import { GrpcModule } from './api/grpc/grpc.module';
import { GraphQLModule } from './api/graphql/graphql.module';
import { CorrelationIdMiddleware } from './core/logging/correlation-id.middleware';

@Module({
  imports: [LoggingModule, HealthModule, GrpcModule, GraphQLModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
