import { IsString, IsEnum } from 'class-validator';

/**
 * DTO for sorting query results
 */
export class SortDto {
  @IsString()
  field: string;

  @IsEnum(['asc', 'desc'])
  order: 'asc' | 'desc';
}
