import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StaffProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  positionTitle?: string;

  @IsString()
  @IsOptional()
  employeeCode?: string;

  @IsOptional()
  hireDate?: Date;
}

export class CreateManagerDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ValidateNested()
  @Type(() => StaffProfileDto)
  @IsNotEmpty()
  staffProfile!: StaffProfileDto;
}
