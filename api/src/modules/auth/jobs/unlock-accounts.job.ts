import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountLockService } from '../services/security/account-lock.service';
import { UserService } from 'src/modules/users/services/user.service';

/**
 * Periodically unlocks accounts whose lock window has expired.
 */
@Injectable()
export class UnlockAccountsJob {
  private readonly logger = new Logger(UnlockAccountsJob.name);

  constructor(
    private readonly userService: UserService,
    private readonly accountLockService: AccountLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const users = await this.userService.findExpiredLockedUsers();

    for (const user of users) {
      await this.accountLockService.unlockUser(
        user.id,
        user.email,
        'automatic_unlock_after_lock_window',
      );
    }

    if (users.length) {
      this.logger.log(`Unlocked ${users.length} expired locked account(s)`);
    }
  }
}
