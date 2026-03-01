import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { UserGrpcController } from './controllers/user.controller';
import { AuthorizationGrpcController } from './controllers/authorization.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { CacheModule } from '../../core/cache/cache.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { UserModule } from '../../modules/user/user.module';
import { PermissionModule } from '../../modules/permission/permission.module';
import { AuthorizationModule } from '../../modules/authorization/authorization.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    AuthModule,
    UserModule,
    PermissionModule,
    AuthorizationModule,
  ],
  controllers: [
    HealthController,
    UserGrpcController,
    AuthorizationGrpcController,
  ],
  providers: [],
  exports: [],
})
export class GrpcModule {}
