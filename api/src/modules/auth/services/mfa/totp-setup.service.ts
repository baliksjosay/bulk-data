import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import authenticator, { generateURI } from 'otplib';
import { Repository } from 'typeorm';
import { AuthChallenge } from '../../entities/auth-challenge.entity';
import { AuthChallengeType } from '../../enums/auth-challenge-type.enum';
import { UserAuthFactor } from '../../entities/user-auth-factor.entity';
import { AuthFactorType } from '../../enums/auth-factor-type.enum';
import { SecurityAuditService } from '../security/security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { ConfigService } from '@nestjs/config';

/**
 * Handles TOTP enrollment, verification, enablement, and disablement.
 */
@Injectable()
export class TotpSetupService {
  private readonly setupTtlMinutes = 10;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly authChallengeRepo: Repository<AuthChallenge>,
    @InjectRepository(UserAuthFactor)
    private readonly factorRepo: Repository<UserAuthFactor>,
    private readonly usersService: UserService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly config: ConfigService,
  ) {}

  async beginSetup(
    userId: string,
    label?: string,
  ): Promise<{
    challengeId: string;
    secret: string;
    otpauthUrl: string;
    expiresAt: Date;
  }> {
    const user = await this.usersService.requireById(userId);

    const secret = authenticator.generateSecret();
    const expiresAt = new Date(Date.now() + this.setupTtlMinutes * 60 * 1000);

    const challenge = this.authChallengeRepo.create({
      userId,
      type: AuthChallengeType.MFA,
      challenge: crypto.randomUUID(),
      isUsed: false,
      expiresAt,
      payload: {
        method: 'TOTP_SETUP',
        secret,
        label: label ?? user.email,
      },
    });

    const saved = await this.authChallengeRepo.save(challenge);

    const otpauthUrl = generateURI({
      secret,
      label: user.email,
      issuer: this.config.get('app.name'),
    });

    return {
      challengeId: saved.id,
      secret,
      otpauthUrl,
      expiresAt,
    };
  }

  async verifySetup(
    userId: string,
    challengeId: string,
    code: string,
    label?: string,
  ): Promise<void> {
    const challenge = await this.authChallengeRepo.findOne({
      where: {
        id: challengeId,
        userId,
        type: AuthChallengeType.MFA,
        isUsed: false,
      },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired TOTP setup challenge');
    }

    const secret = String(challenge.payload?.secret ?? '');
    if (!secret) {
      throw new BadRequestException('Invalid TOTP setup secret');
    }

    const valid = authenticator.verify({
      token: code,
      secret,
    });

    if (!valid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    let factor = await this.factorRepo.findOne({
      where: {
        userId,
        type: AuthFactorType.TOTP,
      },
    });

    if (!factor) {
      factor = this.factorRepo.create({
        userId,
        type: AuthFactorType.TOTP,
        isEnabled: true,
        isPrimary: true,
        isVerified: true,
        label: label ?? String(challenge.payload?.label ?? 'TOTP'),
        config: {
          secret,
        },
      });
    } else {
      factor.isEnabled = true;
      factor.isVerified = true;
      factor.isPrimary = true;
      factor.label = label ?? factor.label;
      factor.config = {
        ...(factor.config ?? {}),
        secret,
      };
    }

    await this.factorRepo.save(factor);

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);

    const user = await this.usersService.requireById(userId);
    user.mfaEnabled = true;
    user.mfaVerified = true;
    await this.usersService.updateMfaState(userId, true, true);
    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_ENABLED,
      userId,
      email: user.email,
      success: true,
      authMethod: 'TOTP',
    });
  }

  async disableTotp(userId: string): Promise<void> {
    const factor = await this.factorRepo.findOne({
      where: {
        userId,
        type: AuthFactorType.TOTP,
        isEnabled: true,
      },
    });

    if (!factor) {
      throw new NotFoundException('No enabled TOTP factor found');
    }

    factor.isEnabled = false;
    factor.isPrimary = false;
    await this.factorRepo.save(factor);

    const user = await this.usersService.requireById(userId);
    user.mfaEnabled = false;
    user.mfaVerified = false;
    await this.usersService.updateMfaState(userId, true, true);

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_DISABLED,
      userId,
      email: user.email,
      success: true,
      authMethod: 'TOTP',
    });
  }
}
