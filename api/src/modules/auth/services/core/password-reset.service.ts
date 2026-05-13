import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';

import { PasswordResetToken } from '../../entities/password-reset-token.entity';
import { PasswordService } from './password.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserSessionsService } from 'src/modules/users/services/user-session.service';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthNotificationService } from './auth-notification.service';

/**
 * Handles password reset request and completion flows.
 */
@Injectable()
export class PasswordResetService {
  private readonly tokenTtlMinutes = 30;

  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<PasswordResetToken>,
    private readonly usersService: UserService,
    private readonly passwordService: PasswordService,
    private readonly userSessionsService: UserSessionsService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  /**
   * Creates a password reset token for a user email.
   *
   * The plain token should be delivered to the user through a secure
   * notification channel. Only the token hash is stored.
   *
   * For unknown emails, a generic token-like response is returned so the
   * caller cannot infer whether the account exists.
   */
  async requestReset(
    email: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + this.tokenTtlMinutes * 60 * 1000),
      };
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await this.passwordService.hash(plainToken);
    const expiresAt = new Date(Date.now() + this.tokenTtlMinutes * 60 * 1000);

    const entity = this.passwordResetTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      isUsed: false,
    });

    await this.passwordResetTokenRepo.save(entity);

    await this.securityAuditService.log({
      eventType: SecurityEventType.PASSWORD_RESET_REQUESTED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendPasswordResetRequested({
      userId: user.id,
      email: user.email,
      resetToken: plainToken,
      expiresAt,
    });

    return {
      token: plainToken,
      expiresAt,
    };
  }

  /**
   * Resets a user password using a valid reset token and revokes
   * all active sessions afterwards.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const activeTokens = await this.passwordResetTokenRepo.find({
      where: { isUsed: false },
      order: { createdAt: 'DESC' },
    });

    let matched: PasswordResetToken | null = null;

    for (const candidate of activeTokens) {
      if (candidate.expiresAt < new Date()) {
        continue;
      }

      const ok = await this.passwordService.compare(token, candidate.tokenHash);
      if (ok) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.usersService.findById(matched.userId);
    if (!user) {
      throw new NotFoundException('User not found for password reset token');
    }

    await this.usersService.setPassword(user.id, newPassword);

    matched.isUsed = true;
    await this.passwordResetTokenRepo.save(matched);

    await this.userSessionsService.revokeAllUserSessions(
      user.id,
      'password_reset_completed',
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.PASSWORD_RESET_COMPLETED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendPasswordResetCompleted({
      userId: user.id,
      email: user.email,
    });
  }

  /**
   * Deletes expired or already-used password reset tokens.
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.passwordResetTokenRepo
      .createQueryBuilder()
      .delete()
      .from(PasswordResetToken)
      .where('isUsed = true')
      .orWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }
}
