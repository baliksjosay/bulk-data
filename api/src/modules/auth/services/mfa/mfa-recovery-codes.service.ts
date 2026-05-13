import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'node:crypto';
import { MfaRecoveryCode } from '../../entities/mfa-recovery-code.entity';
import { MfaRecoveryCodeBatch } from '../../entities/mfa-recovery-code-batches.entity';
import { SecurityAuditService } from '../security/security-audit.service';
import { AuthNotificationService } from '../core/auth-notification.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { SecurityContext } from '../../interfaces/security-context.interface';
import { User } from 'src/modules/users/entities/user.entity';
import { RedisService } from 'src/modules/redis/redis.service';
import { MfaRecoveryStatusDto } from '../../dto/mfa/mfa-recovery-codes.dto';

@Injectable()
export class MfaRecoveryCodeService {
  private readonly codeCount = 10;
  private readonly segmentLength = 4;
  private readonly segmentCount = 3;
  private readonly alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private readonly maxAttempts = 5;
  private readonly attemptWindowSeconds = 15 * 60;
  private readonly lockSeconds = 15 * 60;

  constructor(
    @InjectRepository(MfaRecoveryCode)
    private readonly codeRepo: Repository<MfaRecoveryCode>,
    @InjectRepository(MfaRecoveryCodeBatch)
    private readonly batchRepo: Repository<MfaRecoveryCodeBatch>,
    private readonly dataSource: DataSource,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generates a brand-new active batch of recovery codes.
   * Any previous active batch is revoked.
   * Plain codes are returned only once.
   */
  async generateForUser(
    userId: string,
    email?: string,
  ): Promise<{ batchId: string; codes: string[] }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.update(
        MfaRecoveryCodeBatch,
        { userId, isActive: true },
        {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'regenerated',
        },
      );

      const batch = manager.create(MfaRecoveryCodeBatch, {
        userId,
        isActive: true,
        totalCodes: this.codeCount,
        usedCodes: 0,
      });

      const savedBatch = await manager.save(batch);

      const plainCodes: string[] = [];
      const entities: MfaRecoveryCode[] = [];

      for (let i = 0; i < this.codeCount; i += 1) {
        const plain = this.generateCode();
        plainCodes.push(plain);

        entities.push(
          manager.create(MfaRecoveryCode, {
            userId,
            batchId: savedBatch.id,
            codeHash: this.hashCode(plain),
            isUsed: false,
          }),
        );
      }

      await manager.save(entities);

      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODES_GENERATED,
        userId,
        email,
        success: true,
        metadata: {
          batchId: savedBatch.id,
          totalCodes: this.codeCount,
        },
      });

      return {
        batchId: savedBatch.id,
        codes: plainCodes,
      };
    });
  }

  async hasActiveBatch(userId: string): Promise<boolean> {
    const batch = await this.batchRepo.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return !!batch;
  }

  /**
   * Marks a batch as acknowledged by the user after download/copy.
   */
  async acknowledgeBatch(userId: string, batchId: string): Promise<void> {
    const batch = await this.batchRepo.findOne({
      where: { id: batchId, userId, isActive: true },
    });

    if (!batch) {
      throw new BadRequestException('Recovery code batch not found');
    }

    batch.acknowledgedAt = new Date();
    await this.batchRepo.save(batch);
  }

  /**
   * Validates and consumes a recovery code.
   */
  async verifyAndConsume(
    userId: string,
    code: string,
    context?: SecurityContext,
    usedFor = 'mfa_login_recovery',
    email?: string,
  ): Promise<boolean> {
    await this.assertNotRateLimited(userId);

    const activeBatch = await this.batchRepo.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!activeBatch) {
      await this.registerFailedAttempt(userId);
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_FAILED,
        userId,
        email,
        success: false,
        reason: 'no_active_recovery_batch',
      });
      return false;
    }

    const normalized = this.normalizeCode(code);
    const hashed = this.hashCode(normalized);

    const record = await this.codeRepo.findOne({
      where: {
        userId,
        batchId: activeBatch.id,
        codeHash: hashed,
        isUsed: false,
      },
    });

    if (!record) {
      await this.registerFailedAttempt(userId);
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_FAILED,
        userId,
        email,
        success: false,
        reason: 'invalid_recovery_code',
        metadata: {
          batchId: activeBatch.id,
        },
        ...context,
      });
      return false;
    }

    record.isUsed = true;
    record.usedAt = new Date();
    record.usedFor = usedFor;
    record.usedFromIp = context?.ipAddress ?? null;
    record.usedUserAgent = context?.userAgent ?? null;
    await this.codeRepo.save(record);

    activeBatch.usedCodes += 1;
    if (activeBatch.usedCodes >= activeBatch.totalCodes) {
      activeBatch.isActive = false;
      activeBatch.revokedAt = new Date();
      activeBatch.revokedReason = 'all_codes_consumed';
    }
    await this.batchRepo.save(activeBatch);
    await this.clearAttempts(userId);

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_RECOVERY_CODE_USED,
      userId,
      email,
      success: true,
      metadata: {
        batchId: activeBatch.id,
        remainingCodes: activeBatch.totalCodes - activeBatch.usedCodes,
        usedFor,
      },
      ...context,
    });

    if (email) {
      await this.authNotificationService.sendSuspiciousActivityDetected({
        userId,
        email,
        reason: 'mfa_recovery_code_used',
        metadata: {
          batchId: activeBatch.id,
          usedFor,
          remainingCodes: activeBatch.totalCodes - activeBatch.usedCodes,
        },
      });
    }

    return true;
  }

  /**
   * Returns summary for current active batch.
   */
  async getStatus(
    userId: string,
    isPrivileged = false,
  ): Promise<MfaRecoveryStatusDto> {
    const batch = await this.batchRepo.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!batch) {
      return {
        hasActiveBatch: false,
        totalCodes: 0,
        usedCodes: 0,
        remainingCodes: 0,
        shouldRegenerate: true,
        warning: true,
        warningMessage: 'No active recovery codes found.',
        policyViolation: isPrivileged,
      };
    }

    const remainingCodes = batch.totalCodes - batch.usedCodes;
    const shouldRegenerate = remainingCodes < 2;

    return {
      hasActiveBatch: true,
      totalCodes: batch.totalCodes,
      usedCodes: batch.usedCodes,
      remainingCodes,
      shouldRegenerate,
      warning: shouldRegenerate,
      warningMessage: shouldRegenerate
        ? 'Recovery codes are running low. Regenerate a new batch now.'
        : null,
      policyViolation: isPrivileged && remainingCodes < 2,
    };
  }

  async shouldForceRegenerate(userId: string): Promise<boolean> {
    const status = await this.getStatus(userId);
    return !status.hasActiveBatch || status.remainingCodes < 2;
  }

  async assertNotRateLimited(userId: string): Promise<void> {
    const locked = await this.redisService.exists(this.getLockKey(userId));

    if (locked) {
      throw new UnauthorizedException(
        'Recovery code verification temporarily locked due to repeated failures',
      );
    }
  }

  async registerFailedAttempt(userId: string): Promise<number> {
    const key = this.getAttemptKey(userId);
    const count = await this.redisService.incr(key);

    if (count === 1) {
      await this.redisService.expire(key, this.attemptWindowSeconds);
    }

    if (count >= this.maxAttempts) {
      await this.redisService.set(
        this.getLockKey(userId),
        true,
        this.lockSeconds,
      );
    }

    return count;
  }

  async clearAttempts(userId: string): Promise<void> {
    await this.redisService.del(this.getAttemptKey(userId));
    await this.redisService.del(this.getLockKey(userId));
  }

  async onMfaEnabled(user: User): Promise<string[] | undefined> {
    const hasActiveBatch = await this.hasActiveBatch(user.id);

    if (hasActiveBatch) {
      return undefined;
    }

    const generated = await this.generateForUser(user.id, user.email);

    return generated.codes;
  }

  async findUsersWithoutValidRecoveryCodes(
    userIds?: string[],
  ): Promise<string[]> {
    const qb = this.batchRepo
      .createQueryBuilder('batch')
      .select('batch.userId', 'userId')
      .where('batch.isActive = :active', { active: true });

    if (userIds?.length) {
      qb.andWhere('batch.userId IN (:...userIds)', { userIds });
    }

    const active = await qb.getRawMany<{ userId: string }>();
    const activeIds = new Set(active.map((x) => x.userId));

    return (userIds ?? []).filter((id) => !activeIds.has(id));
  }

  async revokeActiveBatch(userId: string, reason: string): Promise<void> {
    await this.batchRepo.update(
      { userId, isActive: true },
      {
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  private getAttemptKey(userId: string): string {
    return `auth:mfa:recovery:attempts:${userId}`;
  }

  private getLockKey(userId: string): string {
    return `auth:mfa:recovery:locked:${userId}`;
  }

  private generateCode(): string {
    const chars = [];
    for (let i = 0; i < this.segmentLength * this.segmentCount; i += 1) {
      chars.push(this.alphabet[crypto.randomInt(0, this.alphabet.length)]);
    }

    const joined = chars.join('');
    const segments = [];
    for (let i = 0; i < joined.length; i += this.segmentLength) {
      segments.push(joined.slice(i, i + this.segmentLength));
    }

    return segments.join('-');
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private hashCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(this.normalizeCode(code))
      .digest('hex');
  }
}
