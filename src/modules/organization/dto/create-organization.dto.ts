import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { OrganizationType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
