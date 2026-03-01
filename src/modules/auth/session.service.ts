import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * DTO for creating a new session
 */
export interface CreateSessionDto {
  userId: string;
  refreshToken: string;
  accessTokenFingerprint: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

/**
 * Session entity returned from database
 */
export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  accessTokenFingerprint: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * SessionService
 * 
 * Manages user sessions and refresh token lifecycle.
 * Implements session creation, validation, and revocation with bcrypt hashing.
 * 
 * Requirements: 13.1, 13.3, 13.4, 13.6
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly BCRYPT_ROUNDS = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session with refresh token hashing
   * 
   * Requirement 13.1: Store refreshTokenHash, accessTokenFingerprint, ipAddress, 
   * userAgent, and expiresAt timestamp
   * 
   * @param dto - Session creation data
   * @returns Created session record
   */
  async createSession(dto: CreateSessionDto): Promise<Session> {
    this.logger.debug(`Creating session for user ${dto.userId}`);

    // Hash the refresh token before storing
    const refreshTokenHash = await bcrypt.hash(
      dto.refreshToken,
      this.BCRYPT_ROUNDS,
    );

    const session = await this.prisma.sessions.create({
      data: {
        id: uuidv4(),
        userId: dto.userId,
        refreshTokenHash,
        accessTokenFingerprint: dto.accessTokenFingerprint,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        expiresAt: dto.expiresAt,
      },
    });

    this.logger.log(`Session created: ${session.id} for user ${dto.userId}`);
    return session;
  }

  /**
   * Find session by refresh token with hash validation
   * 
   * Requirement 13.4: Validate that revokedAt is NULL and expiresAt is in the future
   * 
   * @param refreshToken - Plaintext refresh token
   * @returns Session if found and valid, null otherwise
   */
  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    this.logger.debug('Finding session by refresh token');

    // Get all non-revoked, non-expired sessions
    const now = new Date();
    const sessions = await this.prisma.sessions.findMany({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });

    // Find session with matching refresh token hash
    for (const session of sessions) {
      const isMatch = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );
      if (isMatch) {
        this.logger.debug(`Session found: ${session.id}`);
        return session;
      }
    }

    this.logger.debug('No matching session found');
    return null;
  }

  /**
   * Revoke a session
   * 
   * Requirement 13.3: Set revokedAt timestamp on the session record
   * 
   * @param sessionId - ID of session to revoke
   */
  async revokeSession(sessionId: string): Promise<void> {
    this.logger.debug(`Revoking session ${sessionId}`);

    await this.prisma.sessions.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.log(`Session revoked: ${sessionId}`);
  }

  /**
   * Revoke all user sessions with exception handling
   * 
   * Requirement 13.6: Allow users to revoke all sessions except the current one
   * 
   * @param userId - User ID whose sessions to revoke
   * @param exceptSessionId - Optional session ID to exclude from revocation
   */
  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Revoking all sessions for user ${userId}${exceptSessionId ? ` except ${exceptSessionId}` : ''}`,
    );

    try {
      const whereClause: any = {
        userId,
        revokedAt: null,
      };

      // Exclude the current session if specified
      if (exceptSessionId) {
        whereClause.id = {
          not: exceptSessionId,
        };
      }

      const result = await this.prisma.sessions.updateMany({
        where: whereClause,
        data: {
          revokedAt: new Date(),
        },
      });

      this.logger.log(
        `Revoked ${result.count} sessions for user ${userId}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.error(
        `Failed to revoke sessions for user ${userId}: ${errorMessage}`,
        errorStack,
      );
      throw new UnauthorizedException('Failed to revoke sessions');
    }
  }

  /**
   * Get active sessions for a user
   * 
   * Requirement 13.6: Allow users to view all active sessions
   * 
   * @param userId - User ID
   * @returns Array of active sessions
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    this.logger.debug(`Getting active sessions for user ${userId}`);

    const now = new Date();
    const sessions = await this.prisma.sessions.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.debug(`Found ${sessions.length} active sessions for user ${userId}`);
    return sessions;
  }
  /**
   * Rotate refresh token by revoking old session and creating new one
   *
   * Requirement 3.4: When a refresh token is used successfully, rotate the refresh token
   * by revoking the old one and issuing a new one with extended expiry
   *
   * @param oldSessionId - ID of the old session to revoke
   * @param newRefreshToken - New plaintext refresh token
   * @param accessTokenFingerprint - Fingerprint of the new access token
   * @returns Created session record
   */
  async rotateRefreshToken(
    oldSessionId: string,
    newRefreshToken: string,
    accessTokenFingerprint: string,
  ): Promise<Session> {
    this.logger.debug(`Rotating refresh token for session ${oldSessionId}`);

    // Get old session to extract user info
    const oldSession = await this.prisma.sessions.findUnique({
      where: { id: oldSessionId },
    });

    if (!oldSession) {
      throw new UnauthorizedException('Session not found');
    }

    // Revoke old session
    await this.revokeSession(oldSessionId);

    // Create new session with extended expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const newSession = await this.createSession({
      userId: oldSession.userId,
      refreshToken: newRefreshToken,
      accessTokenFingerprint,
      ipAddress: oldSession.ipAddress || '',
      userAgent: oldSession.userAgent || '',
      expiresAt,
    });

    this.logger.log(
      `Refresh token rotated: old session ${oldSessionId} -> new session ${newSession.id}`,
    );

    return newSession;
  }
}
