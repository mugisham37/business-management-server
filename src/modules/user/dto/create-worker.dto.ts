import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StaffProfileDto } from './create-manager.dto';

export class CreateWorkerDto {
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

  @ValidateNested()
  @Type(() => StaffProfileDto)
  @IsNotEmpty()
  staffProfile!: StaffProfileDto;

  @IsBoolean()
  @IsOptional()
  usePIN?: boolean;
}
