import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateStaffUserDto } from '../dto/create-staff-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { UserRepository } from '../repositories/user.repository';
import { UserPreferenceRepository } from '../repositories/user-preference.repository';
import { RedisService } from '../../redis/redis.service';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { InitialAdminSeedService } from './initial-admin-seed.service';
import { PasswordPolicyService } from './password-policy.service';

type DemoUserSeed = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  externalId?: string;
  roles: UserRole[];
  password: string;
};

type ManagedStaffRole = UserRole.ADMIN | UserRole.SUPPORT;

type NormalizedCreateStaffUser = {
  email: string;
  phoneNumber?: string;
  lanId?: string;
  role: ManagedStaffRole;
};

type CustomerPortalUserInput = {
  businessName: string;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  createdBy?: string;
};

const STAFF_CREATORS = [UserRole.SUPER_ADMIN, UserRole.ADMIN] as const;
const MANAGED_STAFF_ROLES = [UserRole.ADMIN, UserRole.SUPPORT] as const;

@Injectable()
export class UserService implements OnModuleInit {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly MAX_FAILED_LOGIN_ATTEMPTS = 5;
  private readonly DEFAULT_LOCK_MINUTES = 30;

  private readonly USER_CACHE_TTL = 60 * 5; // 5 minutes
  private readonly USER_LIST_CACHE_TTL = 60; // 1 minute

  constructor(
    private readonly userRepository: UserRepository,
    private readonly preferenceRepository: UserPreferenceRepository,
    private readonly redis: RedisService,
    private readonly initialAdminSeedService: InitialAdminSeedService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.BOOTSTRAP_LOCAL_ADMIN === 'true') {
      await this.initialAdminSeedService.seedFromEnvironment();
    }

    if (process.env.SEED_DEMO_USERS === 'true') {
      await this.seedDemoUsers();
    }
  }

  async create(dto: CreateUserDto, createdBy?: string): Promise<User> {
    await this.ensureCreateConstraints(dto);

    const user = this.userRepository.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email.trim().toLowerCase(),
      phoneNumber: dto.phoneNumber?.trim() || null,
      authProvider: dto.authProvider,
      externalId: dto.externalId?.trim() || null,
      roles: this.normalizeRoles(dto.roles),
      status: dto.status ?? UserStatus.PENDING,
      createdBy: createdBy ?? null,
      emailVerified: dto.authProvider !== AuthProvider.LOCAL,
      phoneVerified: false,
      isLocked: false,
      failedLoginAttempts: 0,
    });

    if (dto.password) {
      user.password = await this.hashPassword(dto.password);
    }

    user.preferences = this.preferenceRepository.createDefault();

    const saved = await this.userRepository.save(user);
    await this.invalidateUserCaches(saved);
    return this.requireById(saved.id);
  }

  private getDemoUserSeeds(): DemoUserSeed[] {
    const password =
      process.env.DEMO_SEED_PASSWORD ??
      process.env.DEMO_ADMIN_PASSWORD ??
      'kimbowa';

    return [
      {
        firstName: 'System',
        lastName: 'Owner',
        email: process.env.DEMO_SUPER_ADMIN_EMAIL ?? 'owner@bulkdata.local',
        phoneNumber: process.env.DEMO_SUPER_ADMIN_PHONE ?? '+256789172797',
        externalId: process.env.DEMO_SUPER_ADMIN_USERNAME ?? 'owner',
        roles: [UserRole.SUPER_ADMIN],
        password,
      },
      {
        firstName: 'Baliks',
        lastName: 'Josay',
        email: process.env.DEMO_ADMIN_EMAIL ?? 'baliksjosay@gmail.com',
        phoneNumber: process.env.DEMO_ADMIN_PHONE ?? '+256789172796',
        externalId: process.env.DEMO_ADMIN_USERNAME ?? 'baliksjosay',
        roles: [UserRole.ADMIN],
        password,
      },
      {
        firstName: 'Support',
        lastName: 'Agent',
        email: process.env.DEMO_SUPPORT_EMAIL ?? 'support@bulkdata.local',
        phoneNumber: process.env.DEMO_SUPPORT_PHONE ?? '+256789172798',
        externalId: process.env.DEMO_SUPPORT_USERNAME ?? 'support',
        roles: [UserRole.SUPPORT],
        password,
      },
      {
        firstName: 'Sarah',
        lastName: 'Namuli',
        email: process.env.DEMO_CUSTOMER_EMAIL ?? 'operations@wavenet.ug',
        phoneNumber: process.env.DEMO_CUSTOMER_PHONE ?? '+256772100201',
        roles: [UserRole.CUSTOMER],
        password,
      },
    ].map((seed) => ({
      ...seed,
      email: seed.email.trim().toLowerCase(),
      phoneNumber: seed.phoneNumber.trim(),
      externalId: seed.externalId?.trim().toLowerCase(),
    }));
  }

  private async seedDemoUsers(): Promise<void> {
    const seeds = this.getDemoUserSeeds();

    for (const seed of seeds) {
      await this.seedDemoUser(seed);
    }
  }

  private async seedDemoUser(seed: DemoUserSeed): Promise<void> {
    const existing = await this.userRepository.findByEmail(seed.email, true);

    if (existing) {
      const oldExternalId = existing.externalId;
      const oldProvider = existing.authProvider;
      existing.firstName = seed.firstName;
      existing.lastName = seed.lastName;
      existing.phoneNumber = existing.phoneNumber || seed.phoneNumber;
      existing.externalId = seed.externalId ?? existing.externalId;
      existing.authProvider = AuthProvider.LOCAL;
      existing.roles = this.normalizeRoles(seed.roles);
      existing.status = UserStatus.ACTIVE;
      existing.emailVerified = true;
      existing.phoneVerified = true;
      existing.isLocked = false;
      existing.failedLoginAttempts = 0;
      existing.mfaEnabled = seed.roles.some((role) =>
        [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
      );
      existing.password = await this.hashPassword(seed.password);

      await this.userRepository.save(existing);
      await this.invalidateUserCaches(existing, { oldExternalId, oldProvider });
      return;
    }

    const user = this.userRepository.create({
      firstName: seed.firstName,
      lastName: seed.lastName,
      email: seed.email,
      phoneNumber: seed.phoneNumber,
      authProvider: AuthProvider.LOCAL,
      externalId: seed.externalId ?? null,
      roles: this.normalizeRoles(seed.roles),
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      isLocked: false,
      failedLoginAttempts: 0,
      mfaEnabled: seed.roles.some((role) =>
        [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
      ),
      password: await this.hashPassword(seed.password),
      preferences: this.preferenceRepository.createDefault(),
    });

    await this.userRepository.save(user);
  }

  async createForActor(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<User> {
    const scopedDto = this.scopeCreateDto(actor, dto);
    return this.create(scopedDto, actor.id);
  }

  async createStaffForActor(
    actor: AuthenticatedUser,
    dto: CreateStaffUserDto,
  ): Promise<User> {
    this.ensureActorCanCreateStaffUsers(actor);

    const normalized = this.normalizeCreateStaffUser(dto);
    await this.ensureCreateStaffConstraints(normalized);

    const names = this.deriveStaffNames(normalized.email, normalized.lanId);
    const user = this.userRepository.create({
      firstName: names.firstName,
      lastName: names.lastName,
      email: normalized.email,
      phoneNumber: normalized.phoneNumber ?? null,
      authProvider: AuthProvider.AD,
      externalId: normalized.lanId ?? null,
      roles: [normalized.role],
      status: UserStatus.ACTIVE,
      createdBy: actor.id,
      emailVerified: true,
      phoneVerified: Boolean(normalized.phoneNumber),
      isLocked: false,
      failedLoginAttempts: 0,
      mfaEnabled: true,
      mfaVerified: false,
      preferences: this.preferenceRepository.createDefault(),
    });

    const saved = await this.userRepository.save(user);
    await this.invalidateUserCaches(saved);
    return this.requireById(saved.id);
  }

  async createOrUpdateCustomerPortalUser(
    input: CustomerPortalUserInput,
  ): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const phoneNumber = this.normalizePhoneNumber(input.phoneNumber);
    const existingByEmail = await this.userRepository.findByEmail(email);
    const existingByPhone =
      await this.userRepository.findByPhoneNumber(phoneNumber);

    if (existingByEmail && !existingByEmail.roles.includes(UserRole.CUSTOMER)) {
      throw new ConflictException(
        'Customer contact email is already linked to another user type',
      );
    }

    if (
      existingByPhone &&
      existingByPhone.id !== existingByEmail?.id &&
      !existingByPhone.roles.includes(UserRole.CUSTOMER)
    ) {
      throw new ConflictException(
        'Customer contact phone is already linked to another user type',
      );
    }

    if (
      existingByPhone &&
      existingByEmail &&
      existingByPhone.id !== existingByEmail.id
    ) {
      throw new ConflictException(
        'Customer contact email and phone belong to different users',
      );
    }

    const existing = existingByEmail ?? existingByPhone;
    const names = this.deriveCustomerNames(
      input.contactPerson,
      input.businessName,
      email,
    );

    if (existing) {
      const oldEmail = existing.email;
      const oldPhone = existing.phoneNumber;
      const oldExternalId = existing.externalId;
      const oldProvider = existing.authProvider;

      existing.firstName = names.firstName;
      existing.lastName = names.lastName;
      existing.email = email;
      existing.phoneNumber = phoneNumber;
      existing.authProvider = AuthProvider.LOCAL;
      existing.externalId = null;
      existing.roles = this.normalizeRoles([
        ...existing.roles,
        UserRole.CUSTOMER,
      ]);
      existing.status =
        existing.status === UserStatus.ACTIVE
          ? UserStatus.ACTIVE
          : UserStatus.PENDING;
      existing.emailVerified =
        existing.status === UserStatus.ACTIVE && oldEmail === email
          ? existing.emailVerified
          : false;
      existing.phoneVerified =
        existing.status === UserStatus.ACTIVE && oldPhone === phoneNumber
          ? existing.phoneVerified
          : false;
      existing.isLocked = false;
      existing.lockedUntil = null;
      existing.failedLoginAttempts = 0;
      existing.mfaEnabled = false;

      await this.userRepository.save(existing);
      await this.invalidateUserCaches(existing, {
        oldEmail,
        oldPhone,
        oldExternalId,
        oldProvider,
      });
      return this.requireById(existing.id);
    }

    const user = this.userRepository.create({
      firstName: names.firstName,
      lastName: names.lastName,
      email,
      phoneNumber,
      authProvider: AuthProvider.LOCAL,
      externalId: null,
      roles: [UserRole.CUSTOMER],
      status: UserStatus.PENDING,
      createdBy: input.createdBy ?? null,
      emailVerified: false,
      phoneVerified: false,
      isLocked: false,
      failedLoginAttempts: 0,
      mfaEnabled: false,
      mfaVerified: false,
      preferences: this.preferenceRepository.createDefault(),
    });

    const saved = await this.userRepository.save(user);
    await this.invalidateUserCaches(saved);
    return this.requireById(saved.id);
  }

  async createInvitedUser(
    dto: CreateUserDto,
    invitedBy: string,
  ): Promise<User> {
    return this.create(
      {
        ...dto,
        status: dto.status ?? UserStatus.PENDING,
      },
      invitedBy,
    );
  }

  async createOrGetSocialUser(params: {
    authProvider: AuthProvider.GOOGLE | AuthProvider.MICROSOFT;
    externalId: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    roles?: UserRole[];
  }): Promise<User> {
    let user = await this.findByExternalIdentity(
      params.authProvider,
      params.externalId,
    );

    if (user) return user;

    const existingByEmail = await this.findByEmail(params.email);
    if (existingByEmail) {
      if (
        existingByEmail.authProvider === AuthProvider.LOCAL &&
        !existingByEmail.externalId
      ) {
        existingByEmail.authProvider = params.authProvider;
        existingByEmail.externalId = params.externalId;
        existingByEmail.emailVerified = true;

        if (!existingByEmail.firstName) {
          existingByEmail.firstName = params.firstName;
        }
        if (!existingByEmail.lastName) {
          existingByEmail.lastName = params.lastName;
        }

        await this.userRepository.save(existingByEmail);
        await this.invalidateUserCaches(existingByEmail);
        return this.requireById(existingByEmail.id);
      }

      throw new ConflictException(
        'A user with this email already exists under another identity',
      );
    }

    user = this.userRepository.create({
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      email: params.email.trim().toLowerCase(),
      phoneNumber: params.phoneNumber?.trim() || null,
      authProvider: params.authProvider,
      externalId: params.externalId,
      roles: this.normalizeRoles(
        params.roles?.length ? params.roles : [UserRole.ADMIN],
      ),
      status: UserStatus.ACTIVE,
      emailVerified: true,
      phoneVerified: false,
      isLocked: false,
      failedLoginAttempts: 0,
      preferences: this.preferenceRepository.createDefault(),
    });

    const saved = await this.userRepository.save(user);
    await this.invalidateUserCaches(saved);
    return this.requireById(saved.id);
  }

  async requireById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async requireByEmail(email: string, includePassword = false): Promise<User> {
    const user = await this.findByEmail(email, includePassword);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const cacheKey = this.getUserIdCacheKey(id);
    const cached = await this.redis.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findById(id);
    if (user) {
      await this.cacheUser(user);
    }

    return user;
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!includePassword) {
      const cacheKey = this.getUserEmailCacheKey(normalizedEmail);
      const cached = await this.redis.get<User>(cacheKey);
      if (cached) return cached;
    }

    const user = await this.userRepository.findByEmail(
      normalizedEmail,
      includePassword,
    );

    if (user && !includePassword) {
      await this.cacheUser(user);
    }

    return user;
  }

  async findByPhoneNumber(
    phoneNumber: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedPhone = phoneNumber.trim();

    if (!includePassword) {
      const cacheKey = this.getUserPhoneCacheKey(normalizedPhone);
      const cached = await this.redis.get<User>(cacheKey);
      if (cached) return cached;
    }

    const user = await this.userRepository.findByPhoneNumber(
      normalizedPhone,
      includePassword,
    );
    if (user && !includePassword) {
      await this.cacheUser(user);
    }

    return user;
  }

  async findByExternalIdentity(
    authProvider: AuthProvider,
    externalId: string,
  ): Promise<User | null> {
    const cacheKey = this.getUserExternalCacheKey(authProvider, externalId);
    const cached = await this.redis.get<User>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findByExternalIdentity(
      authProvider,
      externalId,
    );

    if (user) {
      await this.cacheUser(user);
    }

    return user;
  }

  async findByIdentifier(
    identifier: string,
    includePassword = false,
  ): Promise<User | null> {
    const trimmed = identifier.trim();

    if (trimmed.includes('@')) {
      return this.findByEmail(trimmed, includePassword);
    }

    return this.findByPhoneNumber(trimmed);
  }

  async findByStaffLoginIdentifier(
    identifier: string,
    includePassword = false,
  ): Promise<User | null> {
    const trimmed = identifier.trim().toLowerCase();

    if (!trimmed) {
      return null;
    }

    if (trimmed.includes('@')) {
      return this.findByEmail(trimmed, includePassword);
    }

    const normalizedPhone = this.normalizePhoneNumber(trimmed);
    if (this.looksLikePhoneNumber(normalizedPhone)) {
      const user = await this.findByPhoneNumber(
        normalizedPhone,
        includePassword,
      );
      if (user) {
        return user;
      }
    }

    return this.userRepository.findByExternalId(trimmed, includePassword);
  }

  async syncActiveDirectoryProfile(
    userId: string,
    profile: {
      username?: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      emailAddress?: string;
    },
  ): Promise<User> {
    const user = await this.requireById(userId);
    const oldEmail = user.email;
    const oldPhone = user.phoneNumber;
    const oldExternalId = user.externalId;
    const oldProvider = user.authProvider;

    const firstName = profile.firstName?.trim();
    const lastName = profile.lastName?.trim();

    if (firstName) {
      user.firstName = firstName;
    }

    if (lastName) {
      user.lastName = lastName;
    }

    const displayName = !firstName && !lastName && profile.displayName?.trim();
    if (displayName) {
      const [firstName, ...lastNameParts] = displayName.split(/\s+/);
      user.firstName = firstName || user.firstName;
      user.lastName = lastNameParts.join(' ') || user.lastName;
    }

    const normalizedEmail = profile.emailAddress?.trim().toLowerCase();
    if (normalizedEmail) {
      if (normalizedEmail === user.email) {
        user.emailVerified = true;
      } else {
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing && existing.id !== user.id) {
          throw new ConflictException(
            'Active Directory email is already linked to another user',
          );
        }
        user.email = normalizedEmail;
        user.emailVerified = true;
      }
    }

    const phoneNumber = profile.phoneNumber
      ? this.normalizePhoneNumber(profile.phoneNumber)
      : undefined;
    if (phoneNumber) {
      if (phoneNumber === user.phoneNumber) {
        user.phoneVerified = true;
      } else {
        const existing =
          await this.userRepository.findByPhoneNumber(phoneNumber);
        if (existing && existing.id !== user.id) {
          throw new ConflictException(
            'Active Directory phone number is already linked to another user',
          );
        }
        user.phoneNumber = phoneNumber;
        user.phoneVerified = true;
      }
    }

    const username = profile.username?.trim().toLowerCase();
    if (username && username !== user.externalId) {
      const existing = await this.userRepository.findByExternalId(username);
      if (existing && existing.id !== user.id) {
        throw new ConflictException(
          'Active Directory username is already linked to another user',
        );
      }
      user.externalId = username;
    }

    user.authProvider = AuthProvider.AD;

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user, {
      oldEmail,
      oldPhone,
      oldExternalId,
      oldProvider,
    });

    return this.requireById(user.id);
  }

  async findAll(query: UserQueryDto) {
    const cacheKey = this.getUserListCacheKey(query);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.userRepository.findAll(query);
    await this.redis.set(cacheKey, result, this.USER_LIST_CACHE_TTL);
    return result;
  }

  async findAllForActor(actor: AuthenticatedUser, query: UserQueryDto) {
    return this.findAll(this.scopeQueryForActor(actor, query));
  }

  async findStaffForActor(actor: AuthenticatedUser, query: UserQueryDto) {
    this.ensureActorCanViewStaffUsers(actor);
    const scopedQuery = this.scopeQueryForActor(actor, query);

    if (
      scopedQuery.role &&
      !MANAGED_STAFF_ROLES.includes(scopedQuery.role as ManagedStaffRole)
    ) {
      throw new BadRequestException(
        'Staff role filter must be ADMIN or SUPPORT',
      );
    }

    const cacheKey = this.getStaffUserListCacheKey(scopedQuery);
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.userRepository.findStaffUsers(scopedQuery);
    await this.redis.set(cacheKey, result, this.USER_LIST_CACHE_TTL);
    return result;
  }

  async getMe(userId: string): Promise<User> {
    return this.requireById(userId);
  }

  async requireByIdForActor(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<User> {
    const user = await this.requireById(id);
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.requireById(id);
    const oldEmail = user.email;
    const oldPhone = user.phoneNumber;
    const oldExternalId = user.externalId;
    const oldProvider = user.authProvider;

    if (dto.email && dto.email.trim().toLowerCase() !== user.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email address is already in use');
      }
      user.email = dto.email.trim().toLowerCase();
    }

    if (dto.phoneNumber && dto.phoneNumber.trim() !== user.phoneNumber) {
      const existing = await this.userRepository.findByPhoneNumber(
        dto.phoneNumber.trim(),
      );
      if (existing && existing.id !== id) {
        throw new ConflictException('Phone number is already in use');
      }
      user.phoneNumber = dto.phoneNumber.trim();
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim();
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.roles !== undefined) user.roles = this.normalizeRoles(dto.roles);

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user, {
      oldEmail,
      oldPhone,
      oldExternalId,
      oldProvider,
    });

    return this.requireById(id);
  }

  async updateMe(
    userId: string,
    dto: Pick<UpdateUserDto, 'firstName' | 'lastName' | 'phoneNumber'>,
  ): Promise<User> {
    return this.update(userId, dto);
  }

  async updateForActor(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.requireByIdForActor(actor, id);

    return this.update(user.id, {
      ...dto,
    });
  }

  async activate(id: string): Promise<User> {
    return this.changeStatus(id, UserStatus.ACTIVE);
  }

  async deactivate(id: string): Promise<User> {
    return this.changeStatus(id, UserStatus.INACTIVE);
  }

  async suspend(id: string): Promise<User> {
    return this.changeStatus(id, UserStatus.SUSPENDED);
  }

  async reactivate(id: string): Promise<User> {
    return this.changeStatus(id, UserStatus.ACTIVE);
  }

  async changeStatus(id: string, status: UserStatus): Promise<User> {
    if (status === UserStatus.LOCKED) {
      return this.lockUser(id);
    }

    const user = await this.requireById(id);
    user.status = status;
    user.isLocked = false;
    user.lockedUntil = null;
    await this.redis.del(this.getUserLockCacheKey(id));

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async changeStatusForActor(
    actor: AuthenticatedUser,
    id: string,
    status: UserStatus,
  ): Promise<User> {
    await this.requireByIdForActor(actor, id);
    return this.changeStatus(id, status);
  }

  async assignRoles(id: string, roles: UserRole[]): Promise<User> {
    const user = await this.requireById(id);
    user.roles = [...new Set([...(user.roles ?? []), ...roles])];
    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async removeRoles(id: string, roles: UserRole[]): Promise<User> {
    const user = await this.requireById(id);
    user.roles = (user.roles ?? []).filter((role) => !roles.includes(role));

    if (!user.roles.length) {
      throw new BadRequestException('User must have at least one role');
    }

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async setRoles(id: string, roles: UserRole[]): Promise<User> {
    const user = await this.requireById(id);
    user.roles = this.normalizeRoles(roles);
    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async markEmailVerified(id: string): Promise<User> {
    const user = await this.requireById(id);
    user.emailVerified = true;
    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async markPhoneVerified(id: string): Promise<User> {
    const user = await this.requireById(id);
    user.phoneVerified = true;
    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.requireById(userId);
    if (this.isCustomerLocalAccount(user)) {
      await this.passwordPolicyService.validateCustomerPassword(
        user.id,
        password,
      );
    }

    user.password = await this.hashPassword(password);

    if (user.authProvider !== AuthProvider.LOCAL) {
      user.authProvider = AuthProvider.LOCAL;
    }

    await this.userRepository.save(user);
    if (this.isCustomerLocalAccount(user)) {
      await this.passwordPolicyService.recordPasswordChange(
        user.id,
        user.password,
      );
    }
    await this.invalidateUserCaches(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.requireByIdWithPassword(userId);

    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new BadRequestException(
        'Password change is not available for non-local accounts',
      );
    }

    if (!user.password) {
      throw new BadRequestException('No password is set for this user');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (this.isCustomerLocalAccount(user)) {
      await this.passwordPolicyService.validateCustomerPassword(
        user.id,
        newPassword,
        { enforceMinAge: true },
      );
    }

    user.password = await this.hashPassword(newPassword);
    await this.userRepository.save(user);
    if (this.isCustomerLocalAccount(user)) {
      await this.passwordPolicyService.recordPasswordChange(
        user.id,
        user.password,
      );
    }
    await this.invalidateUserCaches(user);
  }

  async attachSocialIdentity(
    userId: string,
    provider: AuthProvider.GOOGLE | AuthProvider.MICROSOFT,
    externalId: string,
  ): Promise<User> {
    const existing = await this.userRepository.findByExternalIdentity(
      provider,
      externalId,
    );

    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'This social identity is already linked to another user',
      );
    }

    const user = await this.requireById(userId);
    const oldExternalId = user.externalId;
    const oldProvider = user.authProvider;

    user.authProvider = provider;
    user.externalId = externalId;
    user.emailVerified = true;

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user, {
      oldExternalId,
      oldProvider,
    });

    return this.requireById(userId);
  }

  async detachSocialIdentity(userId: string): Promise<User> {
    const user = await this.requireById(userId);

    if (user.authProvider === AuthProvider.LOCAL) {
      return user;
    }

    if (!user.password) {
      throw new BadRequestException(
        'Cannot detach social identity when no local password exists',
      );
    }

    const oldExternalId = user.externalId;
    const oldProvider = user.authProvider;

    user.authProvider = AuthProvider.LOCAL;
    user.externalId = null;

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user, {
      oldExternalId,
      oldProvider,
    });

    return this.requireById(userId);
  }

  async updateMfaState(
    userId: string,
    mfaEnabled: boolean,
    mfaVerified: boolean,
  ): Promise<User> {
    const user = await this.requireById(userId);
    user.mfaEnabled = mfaEnabled;
    user.mfaVerified = mfaVerified;
    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);
    return this.requireById(userId);
  }

  async validateLocalPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false;
    return bcrypt.compare(password, user.password);
  }

  async requireByIdWithPassword(id: string): Promise<User> {
    const user = await this.userRepository.findByIdWithPassword(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async requireByEmailWithPassword(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email, true);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async incrementFailedLoginAttempts(userId: string): Promise<User> {
    const user = await this.requireById(userId);

    const failedKey = this.getUserFailedAttemptsKey(userId);
    const redisAttempts = await this.redis.incr(failedKey);
    await this.redis.expire(failedKey, this.DEFAULT_LOCK_MINUTES * 60);

    user.failedLoginAttempts = Math.max(
      (user.failedLoginAttempts ?? 0) + 1,
      redisAttempts,
    );

    const policy = await this.passwordPolicyService.getEffectivePolicy();
    const lockoutThreshold = this.isCustomerLocalAccount(user)
      ? policy.accountLockoutThreshold
      : this.MAX_FAILED_LOGIN_ATTEMPTS;

    if (user.failedLoginAttempts >= lockoutThreshold) {
      user.isLocked = true;
      user.status = UserStatus.LOCKED;
      user.lockedUntil = new Date(
        Date.now() + this.DEFAULT_LOCK_MINUTES * 60 * 1000,
      );

      await this.redis.set(
        this.getUserLockCacheKey(userId),
        {
          lockedUntil: user.lockedUntil.toISOString(),
          status: user.status,
        },
        this.DEFAULT_LOCK_MINUTES * 60,
      );
    }

    await this.userRepository.save(user);
    await this.invalidateUserCaches(user);

    return this.requireById(userId);
  }

  async findExpiredLockedUsers(): Promise<User[]> {
    return this.userRepository.findExpiredLockedUsers();
  }

  async lockDormantCustomerLocalAccounts(cutoff: Date): Promise<number> {
    const users =
      await this.userRepository.findDormantCustomerLocalUsers(cutoff);

    for (const user of users) {
      user.isLocked = true;
      user.status = UserStatus.LOCKED;
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
      await this.userRepository.save(user);
      await this.redis.del(this.getUserFailedAttemptsKey(user.id));
      await this.redis.del(this.getUserLockCacheKey(user.id));
      await this.invalidateUserCaches(user);
    }

    return users.length;
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginAttempts: 0,
      isLocked: false,
      lockedUntil: null,
    });

    await this.redis.del(this.getUserFailedAttemptsKey(userId));
    await this.redis.del(this.getUserLockCacheKey(userId));

    const user = await this.userRepository.findById(userId);
    if (user) {
      await this.invalidateUserCaches(user);
    }
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginAttempts: 0,
      isLocked: false,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    await this.redis.del(this.getUserFailedAttemptsKey(userId));
    await this.redis.del(this.getUserLockCacheKey(userId));

    const user = await this.userRepository.findById(userId);
    if (user) {
      await this.invalidateUserCaches(user);
    }
  }

  async lockUser(
    id: string,
    minutes = this.DEFAULT_LOCK_MINUTES,
    status: UserStatus = UserStatus.LOCKED,
  ): Promise<User> {
    const user = await this.requireById(id);
    user.isLocked = true;
    user.status = status;
    user.lockedUntil = new Date(Date.now() + minutes * 60 * 1000);

    await this.userRepository.save(user);

    await this.redis.set(
      this.getUserLockCacheKey(id),
      {
        lockedUntil: user.lockedUntil.toISOString(),
        status: user.status,
      },
      minutes * 60,
    );

    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async lockUserForActor(
    actor: AuthenticatedUser,
    id: string,
    minutes = this.DEFAULT_LOCK_MINUTES,
  ): Promise<User> {
    await this.requireByIdForActor(actor, id);
    return this.lockUser(id, minutes);
  }

  async unlockUser(id: string): Promise<User> {
    const user = await this.requireById(id);
    user.isLocked = false;
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;

    if (user.status === UserStatus.LOCKED) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.save(user);

    await this.redis.del(this.getUserFailedAttemptsKey(id));
    await this.redis.del(this.getUserLockCacheKey(id));

    await this.invalidateUserCaches(user);
    return this.requireById(id);
  }

  async unlockUserForActor(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<User> {
    await this.requireByIdForActor(actor, id);
    return this.unlockUser(id);
  }

  async markEmailVerifiedForActor(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<User> {
    await this.requireByIdForActor(actor, id);
    return this.markEmailVerified(id);
  }

  async markPhoneVerifiedForActor(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<User> {
    await this.requireByIdForActor(actor, id);
    return this.markPhoneVerified(id);
  }

  async ensureUserCanLogin(user: User): Promise<void> {
    const lockCache = await this.redis.get<{
      lockedUntil: string;
      status: UserStatus;
    }>(this.getUserLockCacheKey(user.id));

    if (lockCache?.lockedUntil) {
      const lockedUntil = new Date(lockCache.lockedUntil);
      if (lockedUntil > new Date()) {
        throw new UnauthorizedException(
          `Account is locked until ${lockedUntil.toISOString()}`,
        );
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        `User account is ${user.status.toLowerCase()}`,
      );
    }

    if (user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await this.redis.set(
          this.getUserLockCacheKey(user.id),
          {
            lockedUntil: user.lockedUntil.toISOString(),
            status: user.status,
          },
          Math.max(
            1,
            Math.floor((user.lockedUntil.getTime() - Date.now()) / 1000),
          ),
        );

        throw new UnauthorizedException(
          `Account is locked until ${user.lockedUntil.toISOString()}`,
        );
      }

      user.isLocked = false;
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
      user.status = UserStatus.ACTIVE;

      await this.userRepository.save(user);
      await this.redis.del(this.getUserFailedAttemptsKey(user.id));
      await this.redis.del(this.getUserLockCacheKey(user.id));
      await this.invalidateUserCaches(user);
    }
  }

  async delete(id: string): Promise<void> {
    const user = await this.requireById(id);
    await this.userRepository.remove(user);
    await this.invalidateUserCaches(user);
    await this.redis.del(this.getUserFailedAttemptsKey(id));
    await this.redis.del(this.getUserLockCacheKey(id));
  }

  private ensureActorCanCreateStaffUsers(actor: AuthenticatedUser): void {
    const canCreateStaff = actor.roles.some((role) =>
      STAFF_CREATORS.includes(role as UserRole.SUPER_ADMIN | UserRole.ADMIN),
    );

    if (!canCreateStaff) {
      throw new ForbiddenException(
        'Only administrators can create staff users',
      );
    }
  }

  private ensureActorCanViewStaffUsers(actor: AuthenticatedUser): void {
    const canViewStaff = actor.roles.some((role) =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        role as UserRole,
      ),
    );

    if (!canViewStaff) {
      throw new ForbiddenException('Only staff users can view staff accounts');
    }
  }

  private normalizeCreateStaffUser(
    dto: CreateStaffUserDto,
  ): NormalizedCreateStaffUser {
    const role = (dto.role ?? UserRole.SUPPORT) as ManagedStaffRole;

    if (!MANAGED_STAFF_ROLES.includes(role)) {
      throw new BadRequestException('Staff user role must be ADMIN or SUPPORT');
    }

    const phoneNumber = dto.phoneNumber
      ? this.normalizePhoneNumber(dto.phoneNumber)
      : undefined;
    const lanId = dto.lanId?.trim().toLowerCase() || undefined;

    return {
      email: dto.email.trim().toLowerCase(),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(lanId ? { lanId } : {}),
      role,
    };
  }

  private async ensureCreateStaffConstraints(
    dto: NormalizedCreateStaffUser,
  ): Promise<void> {
    if (await this.userRepository.existsByEmail(dto.email)) {
      throw new ConflictException('Email address is already in use');
    }

    if (
      dto.phoneNumber &&
      (await this.userRepository.existsByPhoneNumber(dto.phoneNumber))
    ) {
      throw new ConflictException('Phone number is already in use');
    }

    if (
      dto.lanId &&
      (await this.userRepository.existsByExternalId(dto.lanId))
    ) {
      throw new ConflictException('AD username is already in use');
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    const trimmed = phoneNumber.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (trimmed.startsWith('+')) {
      return `+${digits}`;
    }

    if (digits.length === 10 && digits.startsWith('0')) {
      return `+256${digits.slice(1)}`;
    }

    if (digits.length === 12 && digits.startsWith('256')) {
      return `+${digits}`;
    }

    return trimmed;
  }

  private looksLikePhoneNumber(value: string): boolean {
    return /^\+?\d{9,15}$/.test(value);
  }

  private deriveStaffNames(
    email: string,
    lanId?: string,
  ): { firstName: string; lastName?: string | null } {
    const fallback = lanId || 'staff';
    const localPart = email.split('@')[0]?.trim() || fallback;
    const parts = localPart
      .replace(/[._-]+/g, ' ')
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      firstName: this.toDisplayNamePart(parts[0] ?? fallback),
      lastName:
        parts.length > 1
          ? parts
              .slice(1)
              .map((part) => this.toDisplayNamePart(part))
              .join(' ')
          : null,
    };
  }

  private deriveCustomerNames(
    contactPerson: string,
    businessName: string,
    email: string,
  ): { firstName: string; lastName?: string | null } {
    const source =
      contactPerson.trim() || businessName.trim() || email.split('@')[0] || '';
    const parts = source
      .replace(/[._-]+/g, ' ')
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      firstName: this.toDisplayNamePart(parts[0] ?? 'Customer'),
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

  private async ensureCreateConstraints(dto: CreateUserDto): Promise<void> {
    if (await this.userRepository.existsByEmail(dto.email)) {
      throw new ConflictException('Email address is already in use');
    }

    if (
      dto.phoneNumber?.trim() &&
      (await this.userRepository.existsByPhoneNumber(dto.phoneNumber.trim()))
    ) {
      throw new ConflictException('Phone number is already in use');
    }

    this.validateAuthProviderFields(dto);
  }

  private validateAuthProviderFields(dto: CreateUserDto): void {
    if (dto.authProvider === AuthProvider.LOCAL && !dto.password) {
      throw new BadRequestException(
        'Password is required for local authentication users',
      );
    }

    if (dto.authProvider !== AuthProvider.LOCAL && !dto.externalId) {
      throw new BadRequestException(
        'externalId is required for social authentication users',
      );
    }
  }

  private normalizeRoles(roles: UserRole[]): UserRole[] {
    const normalized = [...new Set(roles)];
    if (!normalized.length) {
      throw new BadRequestException('At least one role is required');
    }
    return normalized;
  }

  private isCustomerLocalAccount(user: Pick<User, 'authProvider' | 'roles'>) {
    return (
      user.authProvider === AuthProvider.LOCAL &&
      user.roles.includes(UserRole.CUSTOMER)
    );
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  private scopeQueryForActor(
    actor: AuthenticatedUser,
    query: UserQueryDto,
  ): UserQueryDto {
    return {
      ...query,
    };
  }

  private scopeCreateDto(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): CreateUserDto {
    const actorRoles = actor.roles as UserRole[];
    const canCreateUsers = actorRoles.some((role) =>
      STAFF_CREATORS.includes(role as UserRole.SUPER_ADMIN | UserRole.ADMIN),
    );

    if (!canCreateUsers) {
      throw new ForbiddenException('Only administrators can create users');
    }

    const isSuperAdmin = actorRoles.includes(UserRole.SUPER_ADMIN);
    if (!isSuperAdmin && dto.roles.includes(UserRole.SUPER_ADMIN)) {
      throw new ForbiddenException(
        'Only super administrators can create super administrators',
      );
    }

    return {
      ...dto,
    };
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

  private getUserListCacheKey(query: UserQueryDto): string {
    return `user:list:${Buffer.from(JSON.stringify(query)).toString('base64')}`;
  }

  private getStaffUserListCacheKey(query: UserQueryDto): string {
    return `user:staff:list:${Buffer.from(JSON.stringify(query)).toString('base64')}`;
  }

  private getUserFailedAttemptsKey(userId: string): string {
    return `user:failed:${userId}`;
  }

  private getUserLockCacheKey(userId: string): string {
    return `user:lock:${userId}`;
  }

  private async cacheUser(user: User): Promise<void> {
    const ops: Record<string, any> = {
      [this.getUserIdCacheKey(user.id)]: user,
      [this.getUserEmailCacheKey(user.email)]: user,
    };

    if (user.phoneNumber) {
      ops[this.getUserPhoneCacheKey(user.phoneNumber)] = user;
    }

    if (user.externalId) {
      ops[this.getUserExternalCacheKey(user.authProvider, user.externalId)] =
        user;
    }

    await this.redis.mset(ops, this.USER_CACHE_TTL);
  }

  private async invalidateUserCaches(
    user: Pick<
      User,
      'id' | 'email' | 'phoneNumber' | 'externalId' | 'authProvider'
    >,
    old?: {
      oldEmail?: string | null;
      oldPhone?: string | null;
      oldExternalId?: string | null;
      oldProvider?: AuthProvider | null;
    },
  ): Promise<void> {
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

    if (old?.oldExternalId && old?.oldProvider) {
      keys.add(
        this.getUserExternalCacheKey(old.oldProvider, old.oldExternalId),
      );
    }

    await this.redis.mdel([...keys]);
    await this.redis.delByPattern('user:list:*');
    await this.redis.delByPattern('user:staff:list:*');
  }
}
