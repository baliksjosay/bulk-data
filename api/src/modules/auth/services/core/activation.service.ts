import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { PasswordService } from './password.service';
import { User } from 'src/modules/users/entities/user.entity';
import { AuthProvider } from 'src/modules/users/enums/auth-provider.enum';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { BulkCustomersRepository } from 'src/modules/bulk-data/repositories';
import { CustomerStatus } from 'src/modules/bulk-data/dto/bulk-data.dto';
import {
  AccountActivationDeliveryChannel,
  AccountActivationOtpRequestDto,
  AccountActivationOtpResponseDto,
  AccountActivationOtpVerifyDto,
  AccountActivationOtpVerifyResponseDto,
} from '../../dto/account-activation.dto';

type ActivationChallengePayload = {
  purpose?:
    | 'customer_activation'
    | 'customer_activation_otp'
    | 'customer_activation_password';
  email?: string;
  otpHash?: string;
  deliveryChannel?: AccountActivationDeliveryChannel;
  parentChallengeId?: string;
  verifiedVia?: AccountActivationDeliveryChannel;
};

/**
 * Handles account activation and invited-user password creation.
 */
@Injectable()
export class ActivationService {
  private readonly activationTtlHours = 48;
  private readonly otpTtlMinutes = 10;
  private readonly passwordSetupTtlMinutes = 60;

  constructor(
    @InjectRepository(AuthChallenge)
    private readonly authChallengeRepo: Repository<AuthChallenge>,
    private readonly usersService: UserService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly authNotificationService: AuthNotificationService,
    private readonly passwordService: PasswordService,
    private readonly bulkCustomersRepository: BulkCustomersRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates an account activation challenge for a user.
   *
   * The plain activation token should be delivered through the notification layer.
   */
  async createActivationChallenge(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date; activationUrl: string }> {
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
        purpose: 'customer_activation',
        email: user.email,
      },
    });

    await this.authChallengeRepo.save(challenge);

    const activationUrl = this.buildActivationUrl(token);

    await this.authNotificationService.sendUserInvitation({
      userId: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      activationUrl,
      expiresAt,
    });

    return { token, expiresAt, activationUrl };
  }

  private buildActivationUrl(token: string): string {
    const configuredBaseUrl =
      this.configService.get<string>('app.frontendUrl') ??
      this.configService.get<string>('app.appUrl') ??
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      'http://localhost:3000';
    const baseUrl = configuredBaseUrl.endsWith('/')
      ? configuredBaseUrl
      : `${configuredBaseUrl}/`;
    const activationUrl = new URL('auth/activate', baseUrl);
    activationUrl.searchParams.set('token', token);

    return activationUrl.toString();
  }

  async requestActivationOtp(
    dto: AccountActivationOtpRequestDto,
  ): Promise<AccountActivationOtpResponseDto> {
    const activationChallenge = await this.findPendingActivationChallenge(
      dto.token,
      ['customer_activation'],
    );
    const user = await this.requireCustomerLocalUser(
      activationChallenge.userId,
    );
    const destination = this.resolveActivationDestination(
      user,
      dto.identifier,
      dto.deliveryChannel,
    );
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpTtlMinutes * 60 * 1000);
    const challenge = this.authChallengeRepo.create({
      userId: user.id,
      type: AuthChallengeType.ACCOUNT_ACTIVATION,
      challenge: crypto.randomUUID(),
      expiresAt,
      isUsed: false,
      payload: {
        purpose: 'customer_activation_otp',
        parentChallengeId: activationChallenge.id,
        otpHash: await this.passwordService.hash(otp),
        deliveryChannel: dto.deliveryChannel,
      },
    });

    const saved = await this.authChallengeRepo.save(challenge);
    await this.authNotificationService.sendCustomerActivationOtpRequested({
      userId: user.id,
      challengeId: saved.id,
      deliveryChannel: dto.deliveryChannel,
      destination,
      otp,
      expiresAt,
    });

    await this.securityAuditService.log({
      eventType:
        dto.deliveryChannel === AccountActivationDeliveryChannel.EMAIL
          ? SecurityEventType.EMAIL_VERIFICATION_SENT
          : SecurityEventType.PHONE_OTP_SENT,
      userId: user.id,
      email: user.email,
      success: true,
      metadata: {
        purpose: 'customer_account_activation',
        deliveryChannel: dto.deliveryChannel,
      },
    });

    const maskedDestination = this.maskDestination(destination);

    return {
      activationId: saved.id,
      maskedDestination,
      maskedEmail:
        dto.deliveryChannel === AccountActivationDeliveryChannel.EMAIL
          ? maskedDestination
          : this.maskDestination(user.email),
      deliveryChannel: dto.deliveryChannel,
      expiresAt: expiresAt.toISOString(),
      retryAfterSeconds: 60,
    };
  }

  async verifyActivationOtp(
    dto: AccountActivationOtpVerifyDto,
  ): Promise<AccountActivationOtpVerifyResponseDto> {
    const activationChallenge = await this.findPendingActivationChallenge(
      dto.token,
      ['customer_activation'],
    );
    const otpChallenge = await this.authChallengeRepo.findOne({
      where: {
        id: dto.activationId,
        type: AuthChallengeType.ACCOUNT_ACTIVATION,
        isUsed: false,
      },
    });

    if (!otpChallenge || otpChallenge.expiresAt < new Date()) {
      throw new BadRequestException('Activation OTP is invalid or expired');
    }

    const payload = this.getChallengePayload(otpChallenge);
    if (
      payload.purpose !== 'customer_activation_otp' ||
      payload.parentChallengeId !== activationChallenge.id ||
      typeof payload.otpHash !== 'string'
    ) {
      throw new BadRequestException('Activation OTP is invalid or expired');
    }

    const otpValid = await this.passwordService.compare(
      dto.otp,
      payload.otpHash,
    );
    if (!otpValid) {
      throw new BadRequestException('Activation OTP is invalid or expired');
    }

    otpChallenge.isUsed = true;
    await this.authChallengeRepo.save(otpChallenge);

    const expiresAt = new Date(
      Date.now() + this.passwordSetupTtlMinutes * 60 * 1000,
    );
    const passwordSetupChallenge = this.authChallengeRepo.create({
      userId: activationChallenge.userId,
      type: AuthChallengeType.ACCOUNT_ACTIVATION,
      challenge: crypto.randomBytes(32).toString('hex'),
      expiresAt,
      isUsed: false,
      payload: {
        purpose: 'customer_activation_password',
        parentChallengeId: activationChallenge.id,
        verifiedVia: payload.deliveryChannel,
      },
    });
    const saved = await this.authChallengeRepo.save(passwordSetupChallenge);

    return {
      passwordSetupToken: saved.challenge,
      expiresAt: expiresAt.toISOString(),
    };
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
  async createPassword(token: string, password: string): Promise<User> {
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

    const payload = this.getChallengePayload(challenge);
    if (
      !user.emailVerified &&
      payload.verifiedVia !== AccountActivationDeliveryChannel.SMS
    ) {
      await this.usersService.markEmailVerified(user.id);
    }

    if (
      !user.phoneVerified &&
      payload.verifiedVia === AccountActivationDeliveryChannel.SMS
    ) {
      await this.usersService.markPhoneVerified(user.id);
    }

    await this.activateLinkedCustomer(user.email);

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);
    if (payload.parentChallengeId) {
      await this.authChallengeRepo.update(
        { id: payload.parentChallengeId },
        { isUsed: true },
      );
    }

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

    return this.usersService.requireById(user.id);
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

  private async findPendingActivationChallenge(
    token: string,
    allowedPurposes: ActivationChallengePayload['purpose'][] = [
      'customer_activation',
      'customer_activation_password',
    ],
  ): Promise<AuthChallenge> {
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

    const payload = this.getChallengePayload(challenge);
    if (payload.purpose && !allowedPurposes.includes(payload.purpose)) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    return challenge;
  }

  private async requireCustomerLocalUser(
    userId?: string | null,
  ): Promise<User> {
    if (!userId) {
      throw new NotFoundException('User not found for activation token');
    }

    const user = await this.usersService.requireById(userId);

    if (
      user.authProvider !== AuthProvider.LOCAL ||
      !user.roles.includes(UserRole.CUSTOMER)
    ) {
      throw new BadRequestException(
        'This activation flow is available only for customer accounts',
      );
    }

    return user;
  }

  private resolveActivationDestination(
    user: User,
    identifier: string,
    deliveryChannel: AccountActivationDeliveryChannel,
  ): string {
    const normalizedIdentifier =
      deliveryChannel === AccountActivationDeliveryChannel.EMAIL
        ? identifier.trim().toLowerCase()
        : this.normalizePhoneNumber(identifier);

    const expected =
      deliveryChannel === AccountActivationDeliveryChannel.EMAIL
        ? user.email.toLowerCase()
        : this.normalizePhoneNumber(user.phoneNumber ?? '');

    if (!expected || normalizedIdentifier !== expected) {
      throw new BadRequestException(
        'Use the email address or phone number registered on the account',
      );
    }

    return expected;
  }

  private async activateLinkedCustomer(email: string): Promise<void> {
    const customer = await this.bulkCustomersRepository.findByEmail(email);
    if (!customer || customer.status === CustomerStatus.ACTIVE) {
      return;
    }

    customer.status = CustomerStatus.ACTIVE;
    await this.bulkCustomersRepository.save(customer);
  }

  private getChallengePayload(
    challenge: AuthChallenge,
  ): ActivationChallengePayload {
    return (challenge.payload ?? {}) as ActivationChallengePayload;
  }

  private generateOtp(): string {
    return crypto.randomInt(10000, 100000).toString();
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

  private maskDestination(destination: string): string {
    const [localPart, domain] = destination.split('@');

    if (domain) {
      return `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
    }

    const digits = destination.replace(/\D/g, '');
    return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
  }
}
