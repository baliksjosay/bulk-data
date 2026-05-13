import { Injectable } from '@nestjs/common';
import { SecurityAuditService } from './security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { RedisService } from 'src/modules/redis/redis.service';

/**
 * Tracks login attempts and warning thresholds using Redis.
 */
@Injectable()
export class LoginAttemptService {
  private readonly warningThreshold = 3;
  private readonly blockThreshold = 5;
  private readonly ttlSeconds = 60 * 30;

  constructor(
    private readonly redis: RedisService,
    private readonly audit: SecurityAuditService,
  ) {}

  private getKey(identifier: string): string {
    return `auth:attempts:${identifier.toLowerCase()}`;
  }

  async increment(
    identifier: string,
    metadata?: Record<string, unknown>,
  ): Promise<number> {
    const key = this.getKey(identifier);
    const attempts = await this.redis.incr(key);
    await this.redis.expire(key, this.ttlSeconds);

    if (attempts === this.warningThreshold) {
      await this.audit.log({
        eventType: SecurityEventType.LOGIN_WARNING_THRESHOLD,
        email: identifier,
        success: false,
        reason: 'warning_threshold_reached',
        metadata,
      });
    }

    return attempts;
  }

  async reset(identifier: string): Promise<void> {
    await this.redis.del(this.getKey(identifier));
  }

  async get(identifier: string): Promise<number> {
    const value = await this.redis.get<number>(this.getKey(identifier));
    return Number(value ?? 0);
  }

  getBlockThreshold(): number {
    return this.blockThreshold;
  }
}
