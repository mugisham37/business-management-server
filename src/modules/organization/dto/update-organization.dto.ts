import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { OrganizationType, OrganizationStatus } from '@prisma/client';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
