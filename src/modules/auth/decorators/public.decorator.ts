import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public Decorator
 * Marks a route as public (bypasses JWT authentication)
 * 
 * @example
 * ```typescript
 * @Public()
 * @Query(() => String)
 * async publicEndpoint() {
 *   return 'This endpoint is public';
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
