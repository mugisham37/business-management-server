import { Module } from '@nestjs/common';
import { PermissionEngineService } from './permission-engine.service';
import { BusinessRulesService } from './business-rules.service';
import { PrismaService } from '../../core/database/prisma.service';
import { LoggerService } from '../../core/logging/logger.service';
import { PermissionModule } from '../permission/permission.module';
import { PermissionGuard } from './guards/permission.guard';
import { HierarchyGuard } from './guards/hierarchy.guard';
import { ScopeGuard } from './guards/scope.guard';
import { BusinessRulesGuard } from './guards/business-rules.guard';

/**
 * Authorization Module
 * Handles four-layer authorization checks and business rules
 */
@Module({
  imports: [PermissionModule],
  providers: [
    PermissionEngineService,
    BusinessRulesService,
    PrismaService,
    LoggerService,
    PermissionGuard,
    HierarchyGuard,
    ScopeGuard,
    BusinessRulesGuard,
  ],
  exports: [
    PermissionEngineService,
    BusinessRulesService,
    PermissionGuard,
    HierarchyGuard,
    ScopeGuard,
    BusinessRulesGuard,
  ],
})
export class AuthorizationModule {}
