import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { UserGrpcController } from './controllers/user.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { CacheModule } from '../../core/cache/cache.module';
import { AuthModule } from '../../core/auth/auth.module';
import { UserModule } from '../../modules/user/user.module';

@Module({
  imports: [DatabaseModule, CacheModule, AuthModule, UserModule],
  controllers: [HealthController, UserGrpcController],
  providers: [],
  exports: [],
})
export class GrpcModule {}
