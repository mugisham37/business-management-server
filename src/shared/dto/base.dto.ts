import { IsUUID, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Base DTO with common fields present in all entities
 */
export abstract class BaseDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  createdAt?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  updatedAt?: Date;
}
