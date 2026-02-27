import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { CacheModule } from '../../core/cache/cache.module';
import { AuthModule } from '../../core/auth/auth.module';

@Module({
  imports: [DatabaseModule, CacheModule, AuthModule],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class GrpcModule {}
