import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';

import { AuthChallenge } from '../../../entities/auth-challenge.entity';
import { AuthChallengeType } from '../../../enums/auth-challenge-type.enum';
import { MfaMethod } from '../../../enums/mfa-method.enum';
import {
  MfaChallenge,
  MfaProvider,
  MfaVerificationResult,
} from '../../../interfaces/mfa-provider.interface';
import { PasswordService } from '../../core/password.service';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthNotificationService } from '../../core/auth-notification.service';

/**
 * Provides email OTP-based MFA challenges and verification.
 */
@Injectable()
export class EmailOtpMfaProvider implements MfaProvider {
  readonly method = MfaMethod.EMAIL_OTP;

  private readonly challengeTtlMinutes = 10;
  private readonly otpLength = 5;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly authChallengeRepo: Repository<AuthChallenge>,
    private readonly passwordService: PasswordService,
    private readonly usersService: UserService,
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  /**
   * Indicates whether email OTP MFA is available.
   *
   * This provider is available only when the user has an email address.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Creates an email OTP MFA challenge and sends the OTP
   * through the auth notification service.
   */
  async createChallenge(
    userId: string,
    context?: Record<string, unknown>,
  ): Promise<MfaChallenge> {
    const user = await this.usersService.requireById(userId);

    if (!user.email) {
      throw new BadRequestException(
        'User does not have an email address for email OTP MFA',
      );
    }

    const otp = this.generateNumericOtp(this.otpLength);
    const otpHash = await this.passwordService.hash(otp);
    const expiresAt = new Date(
      Date.now() + this.challengeTtlMinutes * 60 * 1000,
    );

    const challenge = this.authChallengeRepo.create({
      userId,
      type: AuthChallengeType.MFA,
      challenge: crypto.randomUUID(),
      expiresAt,
      isUsed: false,
      payload: {
        ...context,
        method: this.method,
        otpHash,
        email: user.email,
      },
    });

    const saved = await this.authChallengeRepo.save(challenge);

    await this.authNotificationService.sendEmailOtpMfaRequested({
      userId: user.id,
      email: user.email,
      challengeId: saved.id,
      otp,
      expiresAt,
    });

    return {
      challengeId: saved.id,
      method: this.method,
      expiresAt,
      metadata: {
        email: user.email,
      },
    };
  }

  /**
   * Verifies the submitted email OTP against the stored challenge hash.
   */
  async verifyChallenge(
    userId: string,
    challengeId: string,
    response: Record<string, unknown>,
  ): Promise<MfaVerificationResult> {
    const challenge = await this.authChallengeRepo.findOne({
      where: {
        id: challengeId,
        userId,
        type: AuthChallengeType.MFA,
        isUsed: false,
      },
    });

    if (!challenge) {
      return {
        success: false,
        reason: 'mfa_challenge_not_found',
      };
    }

    if (challenge.expiresAt < new Date()) {
      return {
        success: false,
        reason: 'mfa_challenge_expired',
      };
    }

    const expectedMethod = String(challenge.payload?.method ?? '');
    if (expectedMethod !== this.method) {
      return {
        success: false,
        reason: 'mfa_challenge_method_mismatch',
      };
    }

    const submittedCode = String(response.code ?? response.otp ?? '').trim();

    if (!submittedCode) {
      return {
        success: false,
        reason: 'missing_otp_code',
      };
    }

    const otpHash = String(challenge.payload?.otpHash ?? '');
    if (!otpHash) {
      return {
        success: false,
        reason: 'missing_stored_otp_hash',
      };
    }

    const valid = await this.passwordService.compare(submittedCode, otpHash);

    if (!valid) {
      return {
        success: false,
        reason: 'invalid_otp_code',
      };
    }

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);

    return {
      success: true,
    };
  }

  /**
   * Generates a numeric OTP.
   */
  private generateNumericOtp(length: number): string {
    const digits = '0123456789';
    let value = '';

    for (let i = 0; i < length; i += 1) {
      value += digits[crypto.randomInt(0, digits.length)];
    }

    return value;
  }
}
