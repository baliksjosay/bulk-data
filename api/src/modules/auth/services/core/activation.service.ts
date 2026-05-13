import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';

import { AuthChallenge } from '../../entities/auth-challenge.entity';
import { AuthChallengeType } from '../../enums/auth-challenge-type.enum';
import { SecurityAuditService } from '../security/security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserStatus } from '../../../users/enums/user-status.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthNotificationService } from './auth-notification.service';

/**
 * Handles account activation and invited-user password creation.
 */
@Injectable()
export class ActivationService {
  private readonly activationTtlHours = 48;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly authChallengeRepo: Repository<AuthChallenge>,
    private readonly usersService: UserService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  /**
   * Creates an account activation challenge for a user.
   *
   * The plain activation token should be delivered through the notification layer.
   */
  async createActivationChallenge(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.usersService.requireById(userId);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.activationTtlHours * 60 * 60 * 1000,
    );

    const challenge = this.authChallengeRepo.create({
      userId: user.id,
      type: AuthChallengeType.ACCOUNT_ACTIVATION,
      challenge: token,
      expiresAt,
      isUsed: false,
      payload: {
        email: user.email,
      },
    });

    await this.authChallengeRepo.save(challenge);

    await this.authNotificationService.sendUserInvitation({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    return { token, expiresAt };
  }

  /**
   * Validates an activation token and activates the account.
   */
  async activateAccount(token: string): Promise<void> {
    const challenge = await this.authChallengeRepo.findOne({
      where: {
        challenge: token,
        type: AuthChallengeType.ACCOUNT_ACTIVATION,
        isUsed: false,
      },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    const user = await this.usersService.findById(challenge.userId);
    if (!user) {
      throw new NotFoundException('User not found for activation token');
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.usersService.activate(user.id);
    }

    if (!user.emailVerified) {
      await this.usersService.markEmailVerified(user.id);
    }

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);

    await this.securityAuditService.log({
      eventType: SecurityEventType.ACCOUNT_ACTIVATED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendAccountActivated({
      userId: user.id,
      email: user.email,
    });
  }

  /**
   * Creates password and activates account for invited users.
   */
  async createPassword(token: string, password: string): Promise<void> {
    const challenge = await this.authChallengeRepo.findOne({
      where: {
        challenge: token,
        type: AuthChallengeType.ACCOUNT_ACTIVATION,
        isUsed: false,
      },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    const user = await this.usersService.findById(challenge.userId);
    if (!user) {
      throw new NotFoundException('User not found for activation token');
    }

    await this.usersService.setPassword(user.id, password);

    if (user.status !== UserStatus.ACTIVE) {
      await this.usersService.activate(user.id);
    }

    if (!user.emailVerified) {
      await this.usersService.markEmailVerified(user.id);
    }

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);

    await this.securityAuditService.log({
      eventType: SecurityEventType.PASSWORD_CREATED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.securityAuditService.log({
      eventType: SecurityEventType.ACCOUNT_ACTIVATED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendAccountActivated({
      userId: user.id,
      email: user.email,
    });
  }

  /**
   * Removes expired or used activation challenges.
   */
  async cleanupExpiredActivationChallenges(): Promise<number> {
    const result = await this.authChallengeRepo
      .createQueryBuilder()
      .delete()
      .from(AuthChallenge)
      .where('type = :type', { type: AuthChallengeType.ACCOUNT_ACTIVATION })
      .andWhere('(isUsed = true OR expiresAt < :now)', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }
}
