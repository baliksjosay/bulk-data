import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../../notifications/services/notifications.service';
import { NotificationChannel } from '../../../notifications/enums/notification-channel.enum';
import { NotificationPriority } from '../../../notifications/enums/notification-priority.enum';
import { NotificationType } from '../../../notifications/enums/notification-type.enum';

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

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Sends an invitation notification to a newly created user.
   */
  async sendUserInvitation(input: {
    userId: string;
    email: string;
    firstName?: string;
    invitedByUserId?: string;
  }): Promise<void> {
    await this.notificationsService.create(
      {
        type: NotificationType.USER_INVITED,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        recipientIds: [input.userId],
        subject: 'You have been invited',
        body: 'Your account has been created. Please activate your account and create your password.',
        priority: NotificationPriority.HIGH,
        data: {
          email: input.email,
          firstName: input.firstName,
          invitedByUserId: input.invitedByUserId,
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
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.SMS],
      recipientIds: [input.userId],
      body: 'Your phone verification code has been generated.',
      priority: NotificationPriority.HIGH,
      data: {
        phoneNumber: input.phoneNumber,
        otp: input.otp,
        expiresAt: input.expiresAt?.toISOString(),
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
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [input.userId],
      subject: 'Your authentication code',
      body: 'Use the one-time code sent to complete your sign-in.',
      priority: NotificationPriority.HIGH,
      data: {
        email: input.email,
        otp: input.otp,
        expiresAt: input.expiresAt.toISOString(),
        purpose: 'mfa_email_otp',
      },
    });
  }
}
