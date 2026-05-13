import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserAuthFactor } from '../../entities/user-auth-factor.entity';
import { AuthFactorType } from '../../enums/auth-factor-type.enum';
import { MfaMethod } from '../../enums/mfa-method.enum';

/**
 * Resolves which MFA factor should be used for a user.
 */
@Injectable()
export class MfaFactorSelectorService {
  constructor(
    @InjectRepository(UserAuthFactor)
    private readonly factorRepo: Repository<UserAuthFactor>,
  ) {}

  /**
   * Returns the user's preferred enabled MFA method.
   */
  async getPreferredMethod(userId: string): Promise<MfaMethod> {
    const factors = await this.factorRepo.find({
      where: {
        userId,
        isEnabled: true,
        isVerified: true,
      },
      order: {
        isPrimary: 'DESC',
        createdAt: 'ASC',
      },
    });

    if (!factors.length) {
      return MfaMethod.EMAIL_OTP;
    }

    const factor = factors[0];
    return this.mapFactorTypeToMethod(factor.type);
  }

  /**
   * Returns all enabled MFA methods for a user.
   */
  async getEnabledMethods(userId: string): Promise<MfaMethod[]> {
    const factors = await this.factorRepo.find({
      where: {
        userId,
        isEnabled: true,
        isVerified: true,
      },
      order: {
        isPrimary: 'DESC',
        createdAt: 'ASC',
      },
    });

    return [
      ...new Set(
        factors.map((factor) => this.mapFactorTypeToMethod(factor.type)),
      ),
    ];
  }

  /**
   * Returns whether the given MFA method is enabled for a user.
   */
  async isMethodEnabled(userId: string, method: MfaMethod): Promise<boolean> {
    const factors = await this.factorRepo.find({
      where: {
        userId,
        isEnabled: true,
        isVerified: true,
      },
    });

    return factors.some(
      (factor) => this.mapFactorTypeToMethod(factor.type) === method,
    );
  }

  private mapFactorTypeToMethod(type: AuthFactorType): MfaMethod {
    switch (type) {
      case AuthFactorType.TOTP:
        return MfaMethod.TOTP;
      case AuthFactorType.EMAIL_OTP:
        return MfaMethod.EMAIL_OTP;
      case AuthFactorType.SMS_OTP:
        return MfaMethod.SMS_OTP;
      case AuthFactorType.WEBAUTHN:
      case AuthFactorType.PASSKEY:
      case AuthFactorType.SECURITY_KEY:
        return MfaMethod.WEBAUTHN;
      default:
        throw new NotFoundException(`Unsupported MFA factor type: ${type}`);
    }
  }
}
