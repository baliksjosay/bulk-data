import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as authenticator from 'otplib';
import { Repository } from 'typeorm';
import { MfaMethod } from '../../../enums/mfa-method.enum';
import {
  MfaChallenge,
  MfaProvider,
  MfaVerificationResult,
} from '../../../interfaces/mfa-provider.interface';
import { AuthChallenge } from '../../../entities/auth-challenge.entity';
import { AuthChallengeType } from '../../../enums/auth-challenge-type.enum';
import { UserAuthFactor } from '../../../entities/user-auth-factor.entity';
import { AuthFactorType } from '../../../enums/auth-factor-type.enum';

/**
 * Implements TOTP-based MFA, compatible with Google Authenticator
 * and Microsoft Authenticator.
 */
@Injectable()
export class TotpMfaProvider implements MfaProvider {
  readonly method = MfaMethod.TOTP;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly challengeRepo: Repository<AuthChallenge>,
    @InjectRepository(UserAuthFactor)
    private readonly factorRepo: Repository<UserAuthFactor>,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async createChallenge(userId: string): Promise<MfaChallenge> {
    const challenge = this.challengeRepo.create({
      userId,
      type: AuthChallengeType.MFA,
      challenge: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      payload: { method: this.method },
    });

    const saved = await this.challengeRepo.save(challenge);

    return {
      challengeId: saved.id,
      method: this.method,
      expiresAt: saved.expiresAt,
    };
  }

  async verifyChallenge(
    userId: string,
    challengeId: string,
    response: Record<string, unknown>,
  ): Promise<MfaVerificationResult> {
    const challenge = await this.challengeRepo.findOne({
      where: { id: challengeId, userId, isUsed: false },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      return { success: false, reason: 'invalid_or_expired_challenge' };
    }

    const factor = await this.factorRepo.findOne({
      where: { userId, type: AuthFactorType.TOTP, isEnabled: true },
    });

    if (!factor?.config?.secret) {
      return { success: false, reason: 'totp_factor_not_configured' };
    }

    const code = String(response.code ?? '');
    const valid = authenticator.verify({
      token: code,
      secret: String(factor.config.secret),
    });

    if (!valid) {
      return { success: false, reason: 'invalid_totp_code' };
    }

    challenge.isUsed = true;
    await this.challengeRepo.save(challenge);

    return { success: true };
  }
}
