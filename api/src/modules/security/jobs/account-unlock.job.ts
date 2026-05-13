import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRepository } from 'src/modules/users/repositories/user.repository';
import { UserStatus } from 'src/modules/users/enums/user-status.enum';
import { SecurityAuditService } from '../services/audit.service';
import { SecurityEventType } from 'src/modules/auth/enums/security-event-type.enum';

@Injectable()
export class AccountUnlockJob {
  private readonly logger = new Logger(AccountUnlockJob.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const users = await this.userRepository.findExpiredLockedUsers();

    for (const user of users) {
      user.isLocked = false;
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
      user.status = UserStatus.ACTIVE;

      await this.userRepository.save(user);

      await this.securityAuditService.log({
        eventType: SecurityEventType.ACCOUNT_UNLOCKED,
        userId: user.id,
        email: user.email,
        success: true,
        reason: 'automatic_unlock_after_lock_window',
      });
    }

    if (users.length) {
      this.logger.log(`Unlocked ${users.length} expired locked account(s)`);
    }
  }
}
