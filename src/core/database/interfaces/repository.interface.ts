/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Filter parameters for queries
 */
export interface FilterParams {
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
}

/**
 * Base repository interface defining CRUD operations
 */
export interface IRepository<T> {
  /**
   * Find entity by ID
   */
  findById(id: string, include?: Record<string, any>): Promise<T | null>;

  /**
   * Find single entity matching criteria
   */
  findOne(where: Record<string, any>, include?: Record<string, any>): Promise<T | null>;

  /**
   * Find multiple entities matching criteria
   */
  findMany(filter?: FilterParams): Promise<T[]>;

  /**
   * Find entities with pagination
   */
  paginate(params: PaginationParams, filter?: FilterParams): Promise<PaginatedResult<T>>;

  /**
   * Count entities matching criteria
   */
  count(where?: Record<string, any>): Promise<number>;

  /**
   * Create new entity
   */
  create(data: any): Promise<T>;

  /**
   * Create multiple entities
   */
  createMany(data: any[]): Promise<number>;

  /**
   * Update entity by ID
   */
  update(id: string, data: any): Promise<T>;

  /**
   * Update multiple entities
   */
  updateMany(where: Record<string, any>, data: any): Promise<number>;

  /**
   * Delete entity by ID (hard delete)
   */
  delete(id: string): Promise<T>;

  /**
   * Soft delete entity by ID
   */
  softDelete(id: string): Promise<T>;

  /**
   * Delete multiple entities
   */
  deleteMany(where: Record<string, any>): Promise<number>;

  /**
   * Check if entity exists
   */
  exists(where: Record<string, any>): Promise<boolean>;
}
