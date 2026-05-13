import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserSessionRepository } from '../repositories/user-session.repository';
import { RedisService } from 'src/modules/redis/redis.service';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class UserSessionsService {
  private readonly BCRYPT_ROUNDS = 12;

  private readonly SESSION_CACHE_TTL = 60 * 10; // 10 minutes
  private readonly ACTIVE_SESSIONS_CACHE_TTL = 60 * 2; // 2 minutes
  private readonly TOUCH_CACHE_TTL = 60 * 5; // 5 minutes

  constructor(
    private readonly sessionRepository: UserSessionRepository,
    private readonly redis: RedisService,
  ) {}

  async createSession(params: {
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
  }): Promise<UserSession> {
    const refreshTokenHash = await bcrypt.hash(
      params.refreshToken,
      this.BCRYPT_ROUNDS,
    );

    const session = this.sessionRepository.create({
      userId: params.userId,
      refreshTokenHash,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      deviceId: params.deviceId ?? null,
      deviceType: params.deviceType ?? null,
      browser: params.browser ?? null,
      os: params.os ?? null,
      isActive: true,
      expiresAt: params.expiresAt,
      lastActivityAt: new Date(),
    });

    const saved = await this.sessionRepository.save(session);
    await this.invalidateSessionCaches(saved.userId, saved.id);

    return this.getSessionById(saved.id);
  }

  async listActiveSessions(userId: string): Promise<UserSession[]> {
    const cacheKey = this.getActiveSessionsCacheKey(userId);
    const cached = await this.redis.get<UserSession[]>(cacheKey);
    if (cached)
      return cached.map((session) => this.hydrateSessionDates(session));

    const sessions = await this.sessionRepository.findActiveByUserId(userId);
    await this.redis.set(cacheKey, sessions, this.ACTIVE_SESSIONS_CACHE_TTL);

    return sessions.map((session) => this.hydrateSessionDates(session));
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<UserSession> {
    const sessions = await this.listActiveSessions(userId);

    for (const session of sessions) {
      const isRevoked = await this.redis.get<boolean>(
        this.getRevokedSessionKey(session.id),
      );
      if (isRevoked) {
        continue;
      }

      const matches = await bcrypt.compare(
        refreshToken,
        session.refreshTokenHash,
      );
      if (!matches) continue;

      if (session.expiresAt < new Date()) {
        await this.sessionRepository.deactivateById(
          session.id,
          'expired_refresh_token',
        );

        await this.markSessionRevoked(
          session.id,
          session.expiresAt,
          'expired_refresh_token',
        );
        await this.invalidateSessionCaches(userId, session.id);

        throw new UnauthorizedException('Session has expired');
      }

      await this.cacheSession(session);
      return session;
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshToken: string,
    newExpiresAt: Date,
  ): Promise<UserSession> {
    const session = await this.getSessionById(sessionId);

    session.refreshTokenHash = await bcrypt.hash(
      newRefreshToken,
      this.BCRYPT_ROUNDS,
    );
    session.expiresAt = newExpiresAt;
    session.lastActivityAt = new Date();
    session.isActive = true;
    session.revokedAt = null;
    session.revokedReason = null;

    const saved = await this.sessionRepository.save(session);

    await this.redis.del(this.getRevokedSessionKey(sessionId));
    await this.invalidateSessionCaches(saved.userId, saved.id);

    return this.getSessionById(saved.id);
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.sessionRepository.touch(sessionId);

    await this.redis.set(
      this.getTouchCacheKey(sessionId),
      { lastActivityAt: new Date().toISOString() },
      this.TOUCH_CACHE_TTL,
    );

    const session = await this.sessionRepository.findById(sessionId);
    if (session) {
      await this.invalidateSessionCaches(session.userId, session.id);
    }
  }

  /**
   * Determines whether a device has been seen before for the user.
   */
  async isKnownDevice(
    userId: string,
    deviceId?: string | null,
  ): Promise<boolean> {
    if (!deviceId) {
      return false;
    }

    const sessions = await this.listActiveSessions(userId);

    return sessions.some((session) => session.deviceId === deviceId);
  }

  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) return;

    await this.sessionRepository.deactivateById(sessionId, reason);
    await this.markSessionRevoked(sessionId, session.expiresAt, reason);
    await this.invalidateSessionCaches(session.userId, session.id);
  }

  async revokeSessionForUser(
    userId: string,
    sessionId: string,
    reason = 'logout',
  ): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You may only revoke sessions that belong to your account',
      );
    }

    await this.revokeSession(sessionId, reason);
  }

  async revokeAllUserSessions(
    userId: string,
    reason = 'logout_all',
  ): Promise<void> {
    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    await this.sessionRepository.deactivateAllForUser(userId, reason);

    await Promise.all(
      sessions.map((session) =>
        this.markSessionRevoked(session.id, session.expiresAt, reason),
      ),
    );

    await this.invalidateActiveSessionsCache(userId);

    for (const session of sessions) {
      await this.redis.del(this.getSessionCacheKey(session.id));
    }
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    reason = 'logout_other_devices',
  ): Promise<void> {
    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    const sessionsToRevoke = sessions.filter(
      (session) => session.id !== currentSessionId,
    );

    await Promise.all(
      sessionsToRevoke.map(async (session) => {
        await this.sessionRepository.deactivateById(session.id, reason);
        await this.markSessionRevoked(session.id, session.expiresAt, reason);
        await this.redis.del(this.getSessionCacheKey(session.id));
      }),
    );

    await this.invalidateActiveSessionsCache(userId);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.sessionRepository.findExpiredActiveSessions();
    const affected =
      await this.sessionRepository.deactivateExpiredSessions('expired');

    await Promise.all(
      sessions.map(async (session) => {
        await this.markSessionRevoked(session.id, session.expiresAt, 'expired');
        await this.invalidateSessionCaches(session.userId, session.id);
      }),
    );

    return affected;
  }

  async getSessionById(sessionId: string): Promise<UserSession> {
    const cacheKey = this.getSessionCacheKey(sessionId);
    const cached = await this.redis.get<UserSession>(cacheKey);
    if (cached) return this.hydrateSessionDates(cached);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    await this.cacheSession(session);
    return this.hydrateSessionDates(session);
  }

  private getSessionCacheKey(sessionId: string): string {
    return `session:id:${sessionId}`;
  }

  private getActiveSessionsCacheKey(userId: string): string {
    return `session:user:${userId}:active`;
  }

  private getRevokedSessionKey(sessionId: string): string {
    return `session:revoked:${sessionId}`;
  }

  private getTouchCacheKey(sessionId: string): string {
    return `session:touch:${sessionId}`;
  }

  private async cacheSession(session: UserSession): Promise<void> {
    const ttl = this.getTtlFromDate(session.expiresAt, this.SESSION_CACHE_TTL);

    await this.redis.set(this.getSessionCacheKey(session.id), session, ttl);
  }

  private async invalidateActiveSessionsCache(userId: string): Promise<void> {
    await this.redis.del(this.getActiveSessionsCacheKey(userId));
  }

  private async invalidateSessionCaches(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    await this.redis.del(this.getSessionCacheKey(sessionId));
    await this.redis.del(this.getTouchCacheKey(sessionId));
    await this.invalidateActiveSessionsCache(userId);
  }

  private async markSessionRevoked(
    sessionId: string,
    expiresAt: Date,
    reason?: string,
  ): Promise<void> {
    const ttl = this.getTtlFromDate(expiresAt, 60 * 60 * 24 * 7);

    await this.redis.set(
      this.getRevokedSessionKey(sessionId),
      {
        revoked: true,
        reason: reason ?? 'revoked',
      },
      ttl,
    );
  }

  private getTtlFromDate(date: Date, fallbackSeconds: number): number {
    const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
    return seconds > 0 ? seconds : fallbackSeconds;
  }

  private hydrateSessionDates(session: UserSession): UserSession {
    for (const key of [
      'createdAt',
      'updatedAt',
      'expiresAt',
      'lastActivityAt',
      'revokedAt',
    ] as const) {
      const value = session[key];
      if (value && !(value instanceof Date)) {
        session[key] = new Date(value);
      }
    }

    return session;
  }
}
