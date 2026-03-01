import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EmploymentStatus } from '@prisma/client';

export class UpdateStaffProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  positionTitle?: string;

  @IsString()
  @IsOptional()
  employeeCode?: string;

  @IsString()
  @IsOptional()
  reportsToUserId?: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  hireDate?: Date;

  @IsOptional()
  terminationDate?: Date;

  @IsOptional()
  metadata?: Record<string, any>;
}
