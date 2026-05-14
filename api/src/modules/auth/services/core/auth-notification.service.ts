import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../../notifications/services/notifications.service';
import { NotificationChannel } from '../../../notifications/enums/notification-channel.enum';
import { NotificationPriority } from '../../../notifications/enums/notification-priority.enum';
import { NotificationType } from '../../../notifications/enums/notification-type.enum';

type OtpLogPurpose =
  | 'phone_verification'
  | 'mfa_email_otp'
  | 'mfa_sms_otp'
  | 'customer_login_otp'
  | 'customer_activation_otp';

type DevelopmentOtpLogInput = {
  purpose: OtpLogPurpose;
  userId: string;
  challengeId?: string;
  destination?: string;
  otp?: string;
  expiresAt?: Date;
};

/**
 * Centralizes all authentication and security-related notifications.
 *
 * This service adapts auth use cases to the shared notifications module so that
 * auth services do not need to know channel, priority, or message composition
 * details.
 */
@Injectable()
export class AuthNotificationService {
  private readonly logger = new Logger(AuthNotificationService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sends an invitation notification to a newly created user.
   */
  async sendUserInvitation(input: {
    userId: string;
    email: string;
    phoneNumber?: string;
    firstName?: string;
    invitedByUserId?: string;
    activationUrl?: string;
    expiresAt?: Date;
  }): Promise<void> {
    const greeting = input.firstName ? `Hello ${input.firstName},` : 'Hello,';
    const expiryText = input.expiresAt
      ? ` This link expires at ${input.expiresAt.toISOString()}.`
      : '';
    const activationMessage = input.activationUrl
      ? `Activate your MTN Bulk Data account here: ${input.activationUrl}`
      : 'Please activate your MTN Bulk Data account and create your password.';

    await this.notificationsService.create(
      {
        type: NotificationType.USER_INVITED,
        channels: [NotificationChannel.EMAIL],
        recipientIds: [input.userId],
        subject: 'Activate your MTN Bulk Data account',
        body: `${greeting}\n\n${activationMessage}\n\nOpen the link, choose email or SMS, then use the code sent to you to set your password.${expiryText}`,
        priority: NotificationPriority.HIGH,
        data: {
          email: input.email,
          firstName: input.firstName,
          invitedByUserId: input.invitedByUserId,
          activationUrl: input.activationUrl,
          expiresAt: input.expiresAt?.toISOString(),
        },
      },
      input.invitedByUserId,
    );

    if (!input.phoneNumber || !input.activationUrl) {
      return;
    }

    await this.notificationsService.create(
      {
        type: NotificationType.USER_INVITED,
        channels: [NotificationChannel.SMS],
        recipientIds: [input.userId],
        body: `MTN Bulk Data: activate your account at ${input.activationUrl}. Choose email or SMS on the page to receive your code.${expiryText}`,
        priority: NotificationPriority.HIGH,
        data: {
          phoneNumber: input.phoneNumber,
          activationUrl: input.activationUrl,
          expiresAt: input.expiresAt?.toISOString(),
        },
      },
      input.invitedByUserId,
    );
  }

  /**
   * Sends account activation confirmation.
   */
  async sendAccountActivated(input: {
    userId: string;
    email: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.ACCOUNT_APPROVED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Account activated',
      body: 'Your account has been activated successfully. You can now sign in.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
      },
    });
  }

  /**
   * Sends password reset request notification.
   */
  async sendPasswordResetRequested(input: {
    userId: string;
    email: string;
    resetToken?: string;
    expiresAt?: Date;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.PASSWORD_RESET,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [input.userId],
      subject: 'Password reset requested',
      body: 'A password reset has been requested for your account. If this was not you, please secure your account immediately.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        resetToken: input.resetToken,
        expiresAt: input.expiresAt?.toISOString(),
      },
    });
  }

  /**
   * Sends password reset completion notification.
   */
  async sendPasswordResetCompleted(input: {
    userId: string;
    email: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.PASSWORD_RESET,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Password reset completed',
      body: 'Your password was changed successfully. If you did not perform this action, contact support immediately.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
      },
    });
  }

  /**
   * Sends email verification request notification.
   */
  async sendEmailVerificationRequested(input: {
    userId: string;
    email: string;
    verificationToken?: string;
    expiresAt?: Date;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.EMAIL_VERIFICATION,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [input.userId],
      subject: 'Verify your email address',
      body: 'Please verify your email address to complete account setup.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        verificationToken: input.verificationToken,
        expiresAt: input.expiresAt?.toISOString(),
      },
    });
  }

  /**
   * Sends email verification success notification.
   */
  async sendEmailVerified(input: {
    userId: string;
    email: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.EMAIL_VERIFICATION,
      channels: [NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Email verified',
      body: 'Your email address has been verified successfully.',
      priority: NotificationPriority.NORMAL,
      data: {
        email: input.email,
      },
    });
  }

  /**
   * Sends phone verification OTP notification.
   */
  async sendPhoneVerificationRequested(input: {
    userId: string;
    phoneNumber?: string;
    otp?: string;
    expiresAt?: Date;
    purpose?: Extract<OtpLogPurpose, 'phone_verification' | 'mfa_sms_otp'>;
    challengeId?: string;
  }): Promise<void> {
    this.logOtpInDevelopment({
      purpose: input.purpose ?? 'phone_verification',
      userId: input.userId,
      challengeId: input.challengeId,
      destination: input.phoneNumber,
      otp: input.otp,
      expiresAt: input.expiresAt,
    });

    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.SMS],
      recipientIds: [input.userId],
      body: input.otp
        ? this.buildOtpAutofillMessage({
            label: 'MTN Bulk Data verification',
            otp: input.otp,
            expiresAt: input.expiresAt,
          })
        : 'Your phone verification code has been generated.',
      priority: NotificationPriority.HIGH,
      data: {
        phoneNumber: input.phoneNumber,
        expiresAt: input.expiresAt?.toISOString(),
        containsSensitiveCode: Boolean(input.otp),
        purpose: input.purpose ?? 'phone_verification',
      },
    });
  }

  /**
   * Sends phone verification success notification.
   */
  async sendPhoneVerified(input: {
    userId: string;
    phoneNumber?: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      body: 'Your phone number has been verified successfully.',
      priority: NotificationPriority.NORMAL,
      data: {
        phoneNumber: input.phoneNumber,
      },
    });
  }

  /**
   * Sends failed login warning notification after warning threshold is reached.
   */
  async sendFailedLoginWarning(input: {
    userId: string;
    email: string;
    failedAttempts: number;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Failed login attempts detected',
      body: `We detected ${input.failedAttempts} failed login attempts on your account. If this was not you, please take action immediately.`,
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        failedAttempts: input.failedAttempts,
      },
    });
  }

  /**
   * Sends account locked notification.
   */
  async sendAccountLocked(input: {
    userId: string;
    email: string;
    lockedUntil?: Date | string | null;
    reason?: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [
        NotificationChannel.EMAIL,
        NotificationChannel.IN_APP,
        NotificationChannel.SMS,
      ],
      recipientIds: [input.userId],
      subject: 'Account locked',
      body: input.lockedUntil
        ? `Your account has been locked until ${typeof input.lockedUntil === 'string' ? input.lockedUntil : input.lockedUntil.toISOString()}.`
        : 'Your account has been locked due to security policy.',
      priority: NotificationPriority.CRITICAL,
      data: {
        email: input.email,
        lockedUntil:
          typeof input.lockedUntil === 'string'
            ? input.lockedUntil
            : input.lockedUntil?.toISOString(),
        reason: input.reason,
      },
    });
  }

  /**
   * Sends account unlocked notification.
   */
  async sendAccountUnlocked(input: {
    userId: string;
    email: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Account unlocked',
      body: 'Your account has been unlocked. You may sign in again.',
      priority: NotificationPriority.NORMAL,
      data: {
        email: input.email,
      },
    });
  }

  /**
   * Sends MFA enabled notification.
   */
  async sendMfaEnabled(input: {
    userId: string;
    email: string;
    method?: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Multi-factor authentication enabled',
      body: 'Multi-factor authentication has been enabled on your account.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        method: input.method,
      },
    });
  }

  /**
   * Sends MFA disabled notification.
   */
  async sendMfaDisabled(input: {
    userId: string;
    email: string;
    method?: string;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Multi-factor authentication disabled',
      body: 'Multi-factor authentication has been disabled on your account.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        method: input.method,
      },
    });
  }

  /**
   * Sends suspicious activity notification.
   */
  async sendSuspiciousActivityDetected(input: {
    userId: string;
    email: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [input.userId],
      subject: 'Suspicious activity detected',
      body: 'We detected suspicious activity on your account. Please review your recent security activity and secure your credentials if necessary.',
      priority: NotificationPriority.CRITICAL,
      data: {
        email: input.email,
        reason: input.reason,
        metadata: input.metadata,
      },
    });
  }

  /**
   * Sends email OTP MFA challenge notification.
   */
  async sendEmailOtpMfaRequested(input: {
    userId: string;
    email: string;
    challengeId?: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    this.logOtpInDevelopment({
      purpose: 'mfa_email_otp',
      userId: input.userId,
      challengeId: input.challengeId,
      destination: input.email,
      otp: input.otp,
      expiresAt: input.expiresAt,
    });

    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [input.userId],
      subject: 'Your authentication code',
      body: this.buildOtpAutofillMessage({
        label: 'MTN Bulk Data authentication',
        otp: input.otp,
        expiresAt: input.expiresAt,
      }),
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        expiresAt: input.expiresAt.toISOString(),
        containsSensitiveCode: true,
        purpose: 'mfa_email_otp',
      },
    });
  }

  async sendCustomerLoginOtpRequested(input: {
    userId: string;
    challengeId?: string;
    deliveryChannel: 'sms' | 'email';
    destination: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    this.logOtpInDevelopment({
      purpose: 'customer_login_otp',
      userId: input.userId,
      challengeId: input.challengeId,
      destination: input.destination,
      otp: input.otp,
      expiresAt: input.expiresAt,
    });

    const channel =
      input.deliveryChannel === 'email'
        ? NotificationChannel.EMAIL
        : NotificationChannel.SMS;

    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [channel],
      recipientIds: [input.userId],
      subject:
        input.deliveryChannel === 'email' ? 'Your sign-in code' : undefined,
      body: this.buildOtpAutofillMessage({
        label: 'MTN Bulk Data sign-in',
        otp: input.otp,
        expiresAt: input.expiresAt,
      }),
      priority: NotificationPriority.HIGH,
      data: {
        deliveryChannel: input.deliveryChannel,
        destination: input.destination,
        expiresAt: input.expiresAt.toISOString(),
        containsSensitiveCode: true,
        purpose: 'customer_login_otp',
      },
    });
  }

  async sendCustomerActivationOtpRequested(input: {
    userId: string;
    challengeId?: string;
    deliveryChannel: 'sms' | 'email';
    destination: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    this.logOtpInDevelopment({
      purpose: 'customer_activation_otp',
      userId: input.userId,
      challengeId: input.challengeId,
      destination: input.destination,
      otp: input.otp,
      expiresAt: input.expiresAt,
    });

    const channel =
      input.deliveryChannel === 'email'
        ? NotificationChannel.EMAIL
        : NotificationChannel.SMS;

    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [channel],
      recipientIds: [input.userId],
      subject:
        input.deliveryChannel === 'email'
          ? 'Your account activation code'
          : undefined,
      body: this.buildOtpAutofillMessage({
        label: 'MTN Bulk Data account activation',
        otp: input.otp,
        expiresAt: input.expiresAt,
      }),
      priority: NotificationPriority.HIGH,
      data: {
        deliveryChannel: input.deliveryChannel,
        destination: input.destination,
        expiresAt: input.expiresAt.toISOString(),
        containsSensitiveCode: true,
        purpose: 'customer_activation_otp',
      },
    });
  }

  private logOtpInDevelopment(input: DevelopmentOtpLogInput): void {
    const environment = this.configService.get<string>(
      'app.env',
      process.env.NODE_ENV ?? 'development',
    );

    if (environment !== 'development' || !input.otp) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'development_otp_issued',
        purpose: input.purpose,
        userId: input.userId,
        challengeId: input.challengeId,
        destination: this.maskDestination(input.destination),
        otp: input.otp,
        expiresAt: input.expiresAt?.toISOString(),
      }),
    );
  }

  private buildOtpAutofillMessage(input: {
    label: string;
    otp: string;
    expiresAt?: Date;
  }): string {
    const expiresAt =
      input.expiresAt?.toISOString() ?? 'the stated expiry time';

    return `${input.otp} is your ${input.label} code.\nIt expires at ${expiresAt}.\n\n@${this.otpAutofillDomain()} #${input.otp}`;
  }

  private otpAutofillDomain(): string {
    const configuredDomain =
      this.configService.get<string>('auth.otpAutofillDomain') ??
      process.env.OTP_AUTOFILL_DOMAIN;

    if (configuredDomain?.trim()) {
      return configuredDomain.trim().replace(/^@/, '');
    }

    const configuredUrl =
      this.configService.get<string>('app.frontendUrl') ??
      process.env.FRONTEND_URL;

    if (configuredUrl) {
      try {
        return new URL(configuredUrl).hostname;
      } catch {
        return configuredUrl.replace(/^https?:\/\//, '').split('/')[0];
      }
    }

    return 'bulkdata.mtn.co.ug';
  }

  private maskDestination(destination?: string): string | undefined {
    if (!destination) {
      return undefined;
    }

    const [localPart, domain] = destination.split('@');
    if (domain) {
      const visibleLocal = localPart.slice(0, 2);
      return `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
    }

    const digits = destination.replace(/\D/g, '');
    if (digits.length >= 4) {
      return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
    }

    return '****';
  }
}
