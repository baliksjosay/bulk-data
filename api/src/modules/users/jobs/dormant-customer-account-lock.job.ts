import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PasswordPolicyService } from '../services/password-policy.service';
import { UserService } from '../services/user.service';

@Injectable()
export class DormantCustomerAccountLockJob {
  private readonly logger = new Logger(DormantCustomerAccountLockJob.name);

  constructor(
    private readonly usersService: UserService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  @Cron('0 1 * * *')
  async lockDormantCustomerAccounts(): Promise<void> {
    const cutoff = await this.passwordPolicyService.getDormantCutoffDate();
    const lockedCount =
      await this.usersService.lockDormantCustomerLocalAccounts(cutoff);

    if (lockedCount > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'dormant_customer_accounts_locked',
          lockedCount,
          cutoff: cutoff.toISOString(),
        }),
      );
    }
  }
}
