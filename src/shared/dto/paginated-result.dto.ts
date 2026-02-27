import { IsInt, IsBoolean, IsArray } from 'class-validator';

/**
 * Generic DTO for paginated results
 */
export class PaginatedResultDto<T> {
  @IsArray()
  data: T[];

  @IsInt()
  total: number;

  @IsInt()
  page: number;

  @IsInt()
  limit: number;

  @IsInt()
  totalPages: number;

  @IsBoolean()
  hasNext: boolean;

  @IsBoolean()
  hasPrevious: boolean;

  constructor(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrevious = page > 1;
  }
}
