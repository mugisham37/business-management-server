import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { OrganizationService } from './organization.service';
import { BranchService } from './branch.service';
import { DepartmentService } from './department.service';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationService, BranchService, DepartmentService],
  exports: [OrganizationService, BranchService, DepartmentService],
})
export class OrganizationModule {}
