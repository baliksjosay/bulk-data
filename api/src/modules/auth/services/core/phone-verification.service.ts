import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';

import { PhoneVerificationOtp } from '../../entities/phone-verification-otp.entity';
import { PasswordService } from './password.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthNotificationService } from './auth-notification.service';

/**
 * Handles phone verification OTP issuance and validation.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly otpTtlMinutes = 10;

  constructor(
    @InjectRepository(PhoneVerificationOtp)
    private readonly phoneVerificationOtpRepo: Repository<PhoneVerificationOtp>,
    private readonly passwordService: PasswordService,
    private readonly usersService: UserService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
  ) {}

  /**
   * Creates a phone verification OTP for a user.
   *
   * The plain OTP should be delivered through the notification layer.
   * Only the OTP hash is stored.
   */
  async createOtp(userId: string): Promise<{ otp: string; expiresAt: Date }> {
    const user = await this.usersService.requireById(userId);

    if (!user.phoneNumber) {
      throw new BadRequestException('User has no phone number to verify');
    }

    const otp = this.generateNumericOtp(6);
    const otpHash = await this.passwordService.hash(otp);
    const expiresAt = new Date(Date.now() + this.otpTtlMinutes * 60 * 1000);

    const entity = this.phoneVerificationOtpRepo.create({
      userId: user.id,
      otpHash,
      expiresAt,
      isUsed: false,
    });

    await this.phoneVerificationOtpRepo.save(entity);

    await this.securityAuditService.log({
      eventType: SecurityEventType.PHONE_OTP_SENT,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendPhoneVerificationRequested({
      userId: user.id,
      phoneNumber: user.phoneNumber,
      otp,
      expiresAt,
    });

    return { otp, expiresAt };
  }

  /**
   * Verifies a phone OTP for a user.
   */
  async verifyOtp(userId: string, otp: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeOtps = await this.phoneVerificationOtpRepo.find({
      where: {
        userId,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });

    let matched: PhoneVerificationOtp | null = null;

    for (const candidate of activeOtps) {
      if (candidate.expiresAt < new Date()) {
        continue;
      }

      const ok = await this.passwordService.compare(otp, candidate.otpHash);
      if (ok) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.usersService.markPhoneVerified(userId);

    matched.isUsed = true;
    await this.phoneVerificationOtpRepo.save(matched);

    await this.securityAuditService.log({
      eventType: SecurityEventType.PHONE_VERIFIED,
      userId: user.id,
      email: user.email,
      success: true,
    });

    await this.authNotificationService.sendPhoneVerified({
      userId: user.id,
      phoneNumber: user.phoneNumber,
    });
  }

  /**
   * Deletes expired or used phone verification OTP records.
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.phoneVerificationOtpRepo
      .createQueryBuilder()
      .delete()
      .from(PhoneVerificationOtp)
      .where('isUsed = true')
      .orWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  /**
   * Generates a numeric OTP with the requested length.
   *
   * @param length Number of digits to generate
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
