import { Injectable } from '@nestjs/common';
import { SecurityAuditService } from './security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * Handles user account lock and unlock operations.
 */
@Injectable()
export class AccountLockService {
  private readonly defaultLockMinutes = 30;

  constructor(
    private readonly usersService: UserService,
    private readonly audit: SecurityAuditService,
  ) {}

  async lockUser(
    userId: string,
    email: string,
    reason = 'too_many_failed_login_attempts',
  ): Promise<User> {
    const user = await this.usersService.lockUser(
      userId,
      this.defaultLockMinutes,
    );

    await this.audit.log({
      eventType: SecurityEventType.ACCOUNT_LOCKED,
      userId,
      email,
      success: false,
      reason,
    });
    return user;
  }

  async unlockUser(
    userId: string,
    email: string,
    reason = 'automatic_unlock_after_lock_window',
  ): Promise<void> {
    await this.usersService.unlockUser(userId);

    await this.audit.log({
      eventType: SecurityEventType.ACCOUNT_UNLOCKED,
      userId,
      email,
      success: true,
      reason,
    });
  }
}
