import { IsObject, IsArray, IsOptional } from 'class-validator';

/**
 * DTO for filtering query operations
 */
export class FilterDto {
  @IsObject()
  @IsOptional()
  where?: Record<string, any>;

  @IsArray()
  @IsOptional()
  include?: string[];

  @IsArray()
  @IsOptional()
  select?: string[];
}
