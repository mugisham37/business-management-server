import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/constants';

/**
 * Token blacklist service for managing revoked tokens
 */
@Injectable()
export class TokenBlacklistService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Add a token to the blacklist
   * @param tokenId - Unique identifier from the JWT (jti claim)
   * @param ttl - Time to live in seconds (should match token expiry)
   */
  async addToBlacklist(tokenId: string, ttl?: number): Promise<void> {
    const key = CACHE_KEYS.TOKEN_BLACKLIST(tokenId);
    const expiryTime = ttl || CACHE_TTL.TOKEN_BLACKLIST;
    await this.redisService.set(key, { blacklisted: true }, expiryTime);
  }

  /**
   * Check if a token is blacklisted
   * @param tokenId - Unique identifier from the JWT (jti claim)
   * @returns true if token is blacklisted
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    const key = CACHE_KEYS.TOKEN_BLACKLIST(tokenId);
    return await this.redisService.exists(key);
  }

  /**
   * Remove a token from the blacklist (rarely used)
   * @param tokenId - Unique identifier from the JWT (jti claim)
   */
  async removeFromBlacklist(tokenId: string): Promise<void> {
    const key = CACHE_KEYS.TOKEN_BLACKLIST(tokenId);
    await this.redisService.del(key);
  }

  /**
   * Add multiple tokens to the blacklist
   * @param tokenIds - Array of token identifiers
   * @param ttl - Time to live in seconds
   */
  async addMultipleToBlacklist(tokenIds: string[], ttl?: number): Promise<void> {
    const expiryTime = ttl || CACHE_TTL.TOKEN_BLACKLIST;
    const entries: Record<string, any> = {};

    for (const tokenId of tokenIds) {
      const key = CACHE_KEYS.TOKEN_BLACKLIST(tokenId);
      entries[key] = { blacklisted: true };
    }

    await this.redisService.mset(entries, expiryTime);
  }
}
