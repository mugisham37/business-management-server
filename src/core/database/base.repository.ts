import { PrismaService } from './prisma.service';
import {
  IRepository,
  PaginationParams,
  PaginatedResult,
  FilterParams,
} from './interfaces/repository.interface';

/**
 * Base Repository
 * 
 * Abstract base class providing common CRUD operations for all repositories.
 * Implements the repository pattern with type safety and pagination support.
 * 
 * Features:
 * - Type-safe CRUD operations
 * - Pagination with metadata
 * - Filtering and sorting
 * - Soft delete support
 * - Batch operations
 * 
 * @template T - Entity type
 */
export abstract class BaseRepository<T> implements IRepository<T> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly modelName: string,
  ) {}

  /**
   * Get the Prisma delegate for the model
   */
  protected get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, include?: Record<string, any>): Promise<T | null> {
    return this.model.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Find single entity matching criteria
   */
  async findOne(where: Record<string, any>, include?: Record<string, any>): Promise<T | null> {
    return this.model.findFirst({
      where,
      include,
    });
  }

  /**
   * Find multiple entities matching criteria
   */
  async findMany(filter?: FilterParams): Promise<T[]> {
    return this.model.findMany({
      where: filter?.where,
      include: filter?.include,
      select: filter?.select,
    });
  }

  /**
   * Find entities with pagination
   */
  async paginate(
    params: PaginationParams,
    filter?: FilterParams,
  ): Promise<PaginatedResult<T>> {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // Build order by clause
    const orderBy = params.sortBy
      ? { [params.sortBy]: params.sortOrder || 'asc' }
      : undefined;

    // Execute count and find queries in parallel
    const [total, data] = await Promise.all([
      this.model.count({ where: filter?.where }),
      this.model.findMany({
        where: filter?.where,
        include: filter?.include,
        select: filter?.select,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Count entities matching criteria
   */
  async count(where?: Record<string, any>): Promise<number> {
    return this.model.count({ where });
  }

  /**
   * Create new entity
   */
  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }

  /**
   * Create multiple entities
   */
  async createMany(data: any[]): Promise<number> {
    const result = await this.model.createMany({ data });
    return result.count;
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: any): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Update multiple entities
   */
  async updateMany(where: Record<string, any>, data: any): Promise<number> {
    const result = await this.model.updateMany({
      where,
      data,
    });
    return result.count;
  }

  /**
   * Delete entity by ID (hard delete)
   * Note: This will be intercepted by soft delete middleware for supported models
   */
  async delete(id: string): Promise<T> {
    return this.model.delete({
      where: { id },
    });
  }

  /**
   * Soft delete entity by ID
   * Sets deletedAt timestamp instead of removing the record
   */
  async softDelete(id: string): Promise<T> {
    return this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Delete multiple entities
   */
  async deleteMany(where: Record<string, any>): Promise<number> {
    const result = await this.model.deleteMany({ where });
    return result.count;
  }

  /**
   * Check if entity exists
   */
  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }

  /**
   * Find or create entity
   * Finds entity by criteria, creates if not found
   */
  async findOrCreate(
    where: Record<string, any>,
    create: any,
  ): Promise<{ entity: T; created: boolean }> {
    const existing = await this.findOne(where);
    if (existing) {
      return { entity: existing, created: false };
    }

    const entity = await this.create(create);
    return { entity, created: true };
  }

  /**
   * Update or create entity
   * Updates entity if found, creates if not found
   */
  async upsert(where: Record<string, any>, update: any, create: any): Promise<T> {
    return this.model.upsert({
      where,
      update,
      create,
    });
  }
}
