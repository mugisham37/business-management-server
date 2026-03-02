import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { DatabaseModule } from '../core/database/database.module';
import { CacheModule } from '../core/cache/cache.module';

@Module({
  imports: [
    TerminusModule,
    DatabaseModule,
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
  exports: [TerminusModule, DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
