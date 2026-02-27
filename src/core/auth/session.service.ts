import { Injectable } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { UserContext } from './interfaces';

/**
 * Session Service
 * Manages user sessions in Redis
 */
@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private readonly redisService: RedisService) {}

  /**
   * Create a new session
   * @param sessionId Session identifier
   * @param userContext User context data
   * @param ttl Time to live in seconds (optional)
   */
  async createSession(
    sessionId: string,
    userContext: UserContext,
    ttl?: number,
  ): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redisService.set(key, userContext, ttl || this.SESSION_TTL);
  }

  /**
   * Retrieve session data
   * @param sessionId Session identifier
   * @returns User context or null if session doesn't exist
   */
  async getSession(sessionId: string): Promise<UserContext | null> {
    const key = this.getSessionKey(sessionId);
    return this.redisService.get<UserContext>(key);
  }

  /**
   * Update session data
   * @param sessionId Session identifier
   * @param userContext Updated user context
   * @param ttl Time to live in seconds (optional)
   */
  async updateSession(
    sessionId: string,
    userContext: UserContext,
    ttl?: number,
  ): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redisService.set(key, userContext, ttl || this.SESSION_TTL);
  }

  /**
   * Delete session
   * @param sessionId Session identifier
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redisService.del(key);
  }

  /**
   * Check if session exists
   * @param sessionId Session identifier
   * @returns True if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    return this.redisService.exists(key);
  }

  /**
   * Get session TTL
   * @param sessionId Session identifier
   * @returns Remaining TTL in seconds, or -1 if session doesn't exist
   */
  async getSessionTTL(sessionId: string): Promise<number> {
    const key = this.getSessionKey(sessionId);
    return this.redisService.ttl(key);
  }

  /**
   * Extend session TTL
   * @param sessionId Session identifier
   * @param ttl New TTL in seconds
   */
  async extendSession(sessionId: string, ttl?: number): Promise<void> {
    const key = this.getSessionKey(sessionId);
    const session = await this.getSession(sessionId);
    
    if (session) {
      await this.redisService.set(key, session, ttl || this.SESSION_TTL);
    }
  }

  /**
   * Get session key with prefix
   * @param sessionId Session identifier
   * @returns Prefixed session key
   */
  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }
}
