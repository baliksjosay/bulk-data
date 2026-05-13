import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';

import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { PasswordService } from './password.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthNotificationService } from './auth-notification.service';

/**
 * Handles email verification issuance and confirmation.
 */
@Injectable()
export class EmailVerificationService {
  private readonly tokenTtlHours = 24;

  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly emailVerificationTokenRepo: Repository<EmailVerificationToken>,
    private readonly usersService: UserService,
    private readonly passwordService: PasswordService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  /**
   * Creates an email verification token for a user.
   *
   * The plain token should be delivered through the notification layer.
   * Only the token hash is stored.
   */
  async createVerificationToken(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.usersService.requireById(userId);

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await this.passwordService.hash(plainToken);
    const expiresAt = new Date(
      Date.now() + this.tokenTtlHours * 60 * 60 * 1000,
    );

    const entity = this.emailVerificationTokenRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      isUsed: false,
    });

    await this.emailVerificationTokenRepo.save(entity);

    await this.securityAuditService.log({
      eventType: SecurityEventType.EMAIL_VERIFICATION_SENT,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendEmailVerificationRequested({
      userId: user.id,
      email: user.email,
      verificationToken: plainToken,
      expiresAt,
    });

    return { token: plainToken, expiresAt };
  }

  /**
   * Verifies email using a token.
   */
  async verifyEmail(token: string): Promise<void> {
    const activeTokens = await this.emailVerificationTokenRepo.find({
      where: { isUsed: false },
      order: { createdAt: 'DESC' },
    });

    let matched: EmailVerificationToken | null = null;

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
      throw new BadRequestException(
        'Invalid or expired email verification token',
      );
    }

    const user = await this.usersService.findById(matched.userId);
    if (!user) {
      throw new NotFoundException(
        'User not found for email verification token',
      );
    }

    await this.usersService.markEmailVerified(user.id);

    matched.isUsed = true;
    await this.emailVerificationTokenRepo.save(matched);

    await this.securityAuditService.log({
      eventType: SecurityEventType.EMAIL_VERIFIED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendEmailVerified({
      userId: user.id,
      email: user.email,
    });
  }

  /**
   * Deletes expired and used email verification tokens.
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.emailVerificationTokenRepo
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationToken)
      .where('isUsed = true')
      .orWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }
}
