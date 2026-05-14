import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { RedisService } from '../../redis/redis.service';
import {
  PasswordPolicyResponseDto,
  UpdatePasswordPolicyDto,
} from '../dto/password-policy.dto';

type PasswordHistoryEntry = {
  hash: string;
  changedAt: string;
};

const POLICY_KEY = 'users:password-policy:customer-local';

const DEFAULT_CUSTOMER_PASSWORD_POLICY: PasswordPolicyResponseDto = {
  appliesTo: 'CUSTOMER_LOCAL',
  maxPasswordAgeWarmBodiedDays: 90,
  maxPasswordAgeServiceAccountDays: 365,
  minPasswordAgeDays: 1,
  passwordHistoryCount: 24,
  minPasswordLength: 14,
  complexityEnabled: true,
  hashingEnabled: true,
  accountLockoutThreshold: 3,
  maxSessionsPerUser: 1,
  forcePasswordChangeAtFirstLogin: true,
  inactiveAccountLockDays: 90,
  ssoAllowed: true,
  mfaSupported: true,
  leastPrivilegeEnabled: true,
  rbacEnabled: true,
  pamProvider: 'BeyondTrust',
};

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly redis: RedisService) {}

  async getEffectivePolicy(): Promise<PasswordPolicyResponseDto> {
    const stored = await this.redis.get<Partial<PasswordPolicyResponseDto>>(
      POLICY_KEY,
    );

    return {
      ...DEFAULT_CUSTOMER_PASSWORD_POLICY,
      ...(stored ?? {}),
      appliesTo: 'CUSTOMER_LOCAL',
    };
  }

  async updatePolicy(
    dto: UpdatePasswordPolicyDto,
    updatedBy?: string,
  ): Promise<PasswordPolicyResponseDto> {
    const current = await this.getEffectivePolicy();
    const next: PasswordPolicyResponseDto = {
      ...current,
      ...dto,
      appliesTo: 'CUSTOMER_LOCAL',
      updatedAt: new Date().toISOString(),
      updatedBy,
    };

    await this.redis.set(POLICY_KEY, next);
    return next;
  }

  async validateCustomerPassword(
    userId: string,
    password: string,
    options: { enforceMinAge?: boolean } = {},
  ): Promise<void> {
    const policy = await this.getEffectivePolicy();
    const errors = this.getPasswordPolicyErrors(password, policy);

    if (errors.length) {
      throw new BadRequestException(errors.join(' '));
    }

    const history = await this.getPasswordHistory(userId);
    const latest = history[0];

    if (options.enforceMinAge && latest && policy.minPasswordAgeDays > 0) {
      const earliestChange = new Date(latest.changedAt).getTime();
      const minAgeMs = policy.minPasswordAgeDays * 24 * 60 * 60 * 1000;

      if (Date.now() - earliestChange < minAgeMs) {
        throw new BadRequestException(
          `Password cannot be changed more than once every ${policy.minPasswordAgeDays} day(s).`,
        );
      }
    }

    if (policy.passwordHistoryCount > 0) {
      const recentHistory = history.slice(0, policy.passwordHistoryCount);
      for (const entry of recentHistory) {
        if (await bcrypt.compare(password, entry.hash)) {
          throw new BadRequestException(
            `Password must not match the last ${policy.passwordHistoryCount} password(s).`,
          );
        }
      }
    }
  }

  async recordPasswordChange(userId: string, passwordHash: string): Promise<void> {
    const policy = await this.getEffectivePolicy();
    const history = await this.getPasswordHistory(userId);
    const nextHistory = [
      {
        hash: passwordHash,
        changedAt: new Date().toISOString(),
      },
      ...history,
    ].slice(0, Math.max(policy.passwordHistoryCount, 1));

    await this.redis.set(this.getPasswordHistoryKey(userId), nextHistory);
  }

  async getDormantCutoffDate(): Promise<Date> {
    const policy = await this.getEffectivePolicy();
    return new Date(
      Date.now() - policy.inactiveAccountLockDays * 24 * 60 * 60 * 1000,
    );
  }

  private getPasswordPolicyErrors(
    password: string,
    policy: PasswordPolicyResponseDto,
  ): string[] {
    const errors: string[] = [];

    if (password.length < policy.minPasswordLength) {
      errors.push(
        `Password must be at least ${policy.minPasswordLength} characters long.`,
      );
    }

    if (policy.complexityEnabled) {
      if (!/[a-z]/.test(password)) {
        errors.push('Password must include a lowercase letter.');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must include an uppercase letter.');
      }
      if (!/\d/.test(password)) {
        errors.push('Password must include a number.');
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must include a special character.');
      }
    }

    return errors;
  }

  private async getPasswordHistory(
    userId: string,
  ): Promise<PasswordHistoryEntry[]> {
    const history = await this.redis.get<PasswordHistoryEntry[]>(
      this.getPasswordHistoryKey(userId),
    );

    return Array.isArray(history) ? history : [];
  }

  private getPasswordHistoryKey(userId: string): string {
    return `users:password-history:${userId}`;
  }
}
