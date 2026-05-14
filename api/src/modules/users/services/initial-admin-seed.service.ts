import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { RedisService } from '../../redis/redis.service';
import { User } from '../entities/user.entity';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { UserPreferenceRepository } from '../repositories/user-preference.repository';
import { UserRepository } from '../repositories/user.repository';

export type InitialAdminSeedInput = {
  email: string;
  password: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  resetPassword?: boolean;
};

export type InitialAdminSeedResult = {
  created: boolean;
  email: string;
  externalId?: string | null;
  phoneNumber?: string | null;
  passwordUpdated: boolean;
  userId: string;
};

type PreviousUserCacheIdentity = {
  oldEmail?: string | null;
  oldPhone?: string | null;
  oldExternalId?: string | null;
  oldProvider?: AuthProvider | null;
};

@Injectable()
export class InitialAdminSeedService {
  private readonly bcryptRounds = 12;
  private readonly logger = new Logger(InitialAdminSeedService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly preferenceRepository: UserPreferenceRepository,
    @Optional()
    private readonly redis?: RedisService,
  ) {}

  async seedFromEnvironment(): Promise<InitialAdminSeedResult> {
    return this.seed(this.getSeedInputFromEnvironment());
  }

  async seed(input: InitialAdminSeedInput): Promise<InitialAdminSeedResult> {
    const seed = this.normalizeInput(input);
    const existing = await this.userRepository.findByEmail(seed.email, true);

    if (existing) {
      await this.ensurePhoneNumberIsAvailable(seed.phoneNumber, existing.id);
      const oldCacheIdentity: PreviousUserCacheIdentity = {
        oldEmail: existing.email,
        oldPhone: existing.phoneNumber,
        oldExternalId: existing.externalId,
        oldProvider: existing.authProvider,
      };
      const passwordUpdated = !existing.password || seed.resetPassword === true;

      existing.firstName = existing.firstName || seed.firstName;
      existing.lastName = existing.lastName || seed.lastName;
      existing.phoneNumber = existing.phoneNumber || seed.phoneNumber || null;
      existing.authProvider = AuthProvider.LOCAL;
      existing.externalId = null;
      existing.roles = this.normalizeAdminRoles(existing.roles);
      existing.status = UserStatus.ACTIVE;
      existing.emailVerified = true;
      existing.phoneVerified = Boolean(existing.phoneNumber);
      existing.isLocked = false;
      existing.lockedUntil = null;
      existing.failedLoginAttempts = 0;
      existing.mfaEnabled = true;

      if (passwordUpdated) {
        existing.password = await this.hashPassword(seed.password);
      }

      const saved = await this.userRepository.save(existing);
      await this.ensureDefaultPreferences(saved);
      await this.invalidateUserCaches(saved, oldCacheIdentity);

      this.logger.log(
        JSON.stringify({
          event: 'initial_admin_seed',
          outcome: 'updated',
          userId: saved.id,
          email: saved.email,
          passwordUpdated,
        }),
      );

      return {
        created: false,
        email: saved.email,
        externalId: saved.externalId,
        phoneNumber: saved.phoneNumber,
        passwordUpdated,
        userId: saved.id,
      };
    }

    await this.ensurePhoneNumberIsAvailable(seed.phoneNumber);

    const user = this.userRepository.create({
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: seed.email,
      phoneNumber: seed.phoneNumber ?? null,
      authProvider: AuthProvider.LOCAL,
      externalId: null,
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: Boolean(seed.phoneNumber),
      isLocked: false,
      failedLoginAttempts: 0,
      mfaEnabled: true,
      mfaVerified: false,
      password: await this.hashPassword(seed.password),
      preferences: this.preferenceRepository.createDefault(),
    });

    const saved = await this.userRepository.save(user);
    await this.invalidateUserCaches(saved);

    this.logger.log(
      JSON.stringify({
        event: 'initial_admin_seed',
        outcome: 'created',
        userId: saved.id,
        email: saved.email,
        passwordUpdated: true,
      }),
    );

    return {
      created: true,
      email: saved.email,
      externalId: saved.externalId,
      phoneNumber: saved.phoneNumber,
      passwordUpdated: true,
      userId: saved.id,
    };
  }

  private getSeedInputFromEnvironment(): InitialAdminSeedInput {
    const email = process.env.BOOTSTRAP_LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_LOCAL_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new BadRequestException(
        'BOOTSTRAP_LOCAL_ADMIN_EMAIL and BOOTSTRAP_LOCAL_ADMIN_PASSWORD are required',
      );
    }

    return {
      email,
      password,
      firstName: process.env.BOOTSTRAP_LOCAL_ADMIN_FIRST_NAME,
      lastName: process.env.BOOTSTRAP_LOCAL_ADMIN_LAST_NAME,
      phoneNumber: process.env.BOOTSTRAP_LOCAL_ADMIN_PHONE,
      resetPassword:
        process.env.BOOTSTRAP_LOCAL_ADMIN_RESET_PASSWORD === 'true',
    };
  }

  private normalizeInput(
    input: InitialAdminSeedInput,
  ): Required<
    Pick<InitialAdminSeedInput, 'email' | 'password' | 'firstName' | 'lastName'>
  > &
    Pick<InitialAdminSeedInput, 'phoneNumber' | 'resetPassword'> {
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      throw new BadRequestException(
        'Initial admin email and password are required',
      );
    }

    const names = this.deriveStaffNames(email);

    return {
      email,
      password,
      firstName: input.firstName?.trim() || names.firstName || 'Admin',
      lastName: input.lastName?.trim() || names.lastName || 'User',
      phoneNumber: input.phoneNumber?.trim() || undefined,
      resetPassword: input.resetPassword === true,
    };
  }

  private async ensurePhoneNumberIsAvailable(
    phoneNumber?: string,
    currentUserId?: string,
  ): Promise<void> {
    if (!phoneNumber) {
      return;
    }

    const existing = await this.userRepository.findByPhoneNumber(phoneNumber);
    if (existing && existing.id !== currentUserId) {
      throw new ConflictException('Phone number is already in use');
    }
  }

  private async ensureDefaultPreferences(user: User): Promise<void> {
    if (user.preferences) {
      return;
    }

    const existing = await this.preferenceRepository.findByUserId(user.id);
    if (existing) {
      return;
    }

    await this.preferenceRepository.save(
      this.preferenceRepository.createDefault(user.id),
    );
  }

  private normalizeAdminRoles(roles: UserRole[] = []): UserRole[] {
    return [
      ...new Set([
        ...roles.filter((role) => role !== UserRole.CUSTOMER),
        UserRole.ADMIN,
      ]),
    ];
  }

  private async invalidateUserCaches(
    user: Pick<
      User,
      'id' | 'email' | 'phoneNumber' | 'externalId' | 'authProvider'
    >,
    old?: PreviousUserCacheIdentity,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    const keys = new Set<string>();

    keys.add(this.getUserIdCacheKey(user.id));
    keys.add(this.getUserEmailCacheKey(user.email));

    if (user.phoneNumber) {
      keys.add(this.getUserPhoneCacheKey(user.phoneNumber));
    }

    if (user.externalId) {
      keys.add(
        this.getUserExternalCacheKey(user.authProvider, user.externalId),
      );
    }

    if (old?.oldEmail) {
      keys.add(this.getUserEmailCacheKey(old.oldEmail));
    }

    if (old?.oldPhone) {
      keys.add(this.getUserPhoneCacheKey(old.oldPhone));
    }

    if (old?.oldExternalId && old.oldProvider) {
      keys.add(
        this.getUserExternalCacheKey(old.oldProvider, old.oldExternalId),
      );
    }

    try {
      await this.redis.mdel([...keys]);
      await this.redis.delByPattern('user:list:*');
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'initial_admin_seed_cache_invalidation_failed',
          userId: user.id,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown cache error',
        }),
      );
    }
  }

  private getUserIdCacheKey(id: string): string {
    return `user:id:${id}`;
  }

  private getUserEmailCacheKey(email: string): string {
    return `user:email:${email.toLowerCase()}`;
  }

  private getUserPhoneCacheKey(phoneNumber: string): string {
    return `user:phone:${phoneNumber}`;
  }

  private getUserExternalCacheKey(
    provider: AuthProvider,
    externalId: string,
  ): string {
    return `user:external:${provider}:${externalId}`;
  }

  private deriveStaffNames(email: string): {
    firstName: string;
    lastName?: string | null;
  } {
    const localPart = email.split('@')[0]?.trim() || 'admin';
    const parts = localPart
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      firstName: this.toDisplayNamePart(parts[0] ?? 'Admin'),
      lastName:
        parts.length > 1
          ? parts
              .slice(1)
              .map((part) => this.toDisplayNamePart(part))
              .join(' ')
          : null,
    };
  }

  private toDisplayNamePart(value: string): string {
    if (!value) {
      return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }
}
