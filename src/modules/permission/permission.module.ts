import { Module } from '@nestjs/common';
import { PermissionCacheService } from './permission-cache.service';
import { DelegationValidatorService } from './delegation-validator.service';
import { PermissionService } from './permission.service';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggingModule } from '../../core/logging/logging.module';

/**
 * Permission module handling permission caching, delegation, and management
 */
@Module({
  imports: [
    DatabaseModule,
    LoggingModule,
  ],
  providers: [
    PermissionCacheService,
    DelegationValidatorService,
    PermissionService,
  ],
  exports: [
    PermissionCacheService,
    DelegationValidatorService,
    PermissionService,
  ],
})
export class PermissionModule {}
