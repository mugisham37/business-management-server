import { SetMetadata } from '@nestjs/common';
import { HierarchyLevel } from '@prisma/client';

/**
 * Metadata key for required hierarchy level
 */
export const REQUIRE_LEVEL_KEY = 'requireLevel';

/**
 * Decorator to specify minimum required hierarchy level for a resolver or controller method
 * 
 * @param level - Minimum hierarchy level required (OWNER, MANAGER, or WORKER)
 * 
 * @example
 * ```typescript
 * @RequireLevel(HierarchyLevel.MANAGER)
 * @Mutation(() => User)
 * async createWorker() { ... }
 * ```
 */
export const RequireLevel = (level: HierarchyLevel) =>
  SetMetadata(REQUIRE_LEVEL_KEY, level);
