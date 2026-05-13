import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { SecurityAuditLog } from '../../entities/security-audit-log.entity';
import { SecurityEventType } from '../../enums/security-event-type.enum';

/**
 * Records security-related events for traceability and incident review.
 */
@Injectable()
export class SecurityAuditService {
  constructor(
    @InjectRepository(SecurityAuditLog)
    private readonly repository: Repository<SecurityAuditLog>,
  ) {}

  /**
   * Writes a security audit event.
   */
  async log(input: {
    eventType: SecurityEventType;
    userId?: string | null;
    email?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceId?: string | null;
    deviceType?: string | null;
    authMethod?: string | null;
    authProvider?: string | null;
    success: boolean;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.repository.save(this.repository.create(input));
  }

  /**
   * Counts recent failed login events for a user.
   */
  async countRecentFailedLogins(
    userId: string,
    windowMinutes = 30,
  ): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    return this.repository.count({
      where: {
        userId,
        eventType: SecurityEventType.LOGIN_FAILED,
        createdAt: MoreThan(since),
      },
    });
  }

  /**
   * Returns the most recent successful login audit event for a user.
   */
  async findMostRecentSuccessfulLogin(
    userId: string,
  ): Promise<SecurityAuditLog | null> {
    return this.repository.findOne({
      where: {
        userId,
        eventType: SecurityEventType.LOGIN_SUCCESS,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
