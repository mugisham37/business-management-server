/**
 * Cache key patterns for Redis
 */
export const CACHE_KEYS = {
  /**
   * User permissions cache key
   * Pattern: permissions:{userId}
   */
  PERMISSIONS: (userId: string) => `permissions:${userId}`,

  /**
   * Token blacklist key
   * Pattern: blacklist:token:{tokenId}
   */
  TOKEN_BLACKLIST: (tokenId: string) => `blacklist:token:${tokenId}`,

  /**
   * Rate limit key for login attempts
   * Pattern: ratelimit:login:{email}
   */
  RATE_LIMIT_LOGIN: (email: string) => `ratelimit:login:${email}`,

  /**
   * Rate limit key for API endpoints
   * Pattern: ratelimit:api:{userId}:{endpoint}
   */
  RATE_LIMIT_API: (userId: string, endpoint: string) => 
    `ratelimit:api:${userId}:${endpoint}`,

  /**
   * Session data cache key
   * Pattern: session:{sessionId}
   */
  SESSION: (sessionId: string) => `session:${sessionId}`,
} as const;

/**
 * Cache TTL values in seconds
 */
export const CACHE_TTL = {
  /**
   * Permission cache TTL: 5 minutes
   */
  PERMISSIONS: 300,

  /**
   * Token blacklist TTL: matches JWT expiry (15 minutes)
   */
  TOKEN_BLACKLIST: 900,

  /**
   * Rate limit TTL: 15 minutes
   */
  RATE_LIMIT: 900,

  /**
   * Session cache TTL: 1 hour
   */
  SESSION: 3600,
} as const;
