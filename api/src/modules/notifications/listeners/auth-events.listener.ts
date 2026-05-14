import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../services/notifications.service';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';
import {
  AccountActivatedEvent,
  AccountLockedEvent,
  AccountUnlockedEvent,
  EmailVerificationRequestedEvent,
  EmailVerifiedEvent,
  LoginWarningThresholdReachedEvent,
  MfaDisabledEvent,
  MfaEnabledEvent,
  PasswordResetCompletedEvent,
  PasswordResetRequestedEvent,
  PhoneVerificationRequestedEvent,
  PhoneVerifiedEvent,
  UserInvitedEvent,
} from '../interfaces/auth.interface';

@Injectable()
export class AuthNotificationEventsListener {
  private readonly logger = new Logger(AuthNotificationEventsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('auth.user.invited')
  async handleUserInvited(event: UserInvitedEvent) {
    await this.notificationsService.create({
      type: NotificationType.USER_INVITED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'You have been invited',
      body: 'Your account has been created. Please activate your account and create your password.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
        firstName: event.firstName,
      },
    });
  }

  @OnEvent('auth.account.activated')
  async handleAccountActivated(event: AccountActivatedEvent) {
    await this.notificationsService.create({
      type: NotificationType.ACCOUNT_APPROVED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Account activated',
      body: 'Your account has been activated successfully. You can now sign in.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.password.reset.requested')
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    await this.notificationsService.create({
      type: NotificationType.PASSWORD_RESET,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [event.userId],
      subject: 'Password reset requested',
      body: 'A password reset has been requested for your account. If this was not you, please secure your account immediately.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.password.reset.completed')
  async handlePasswordResetCompleted(event: PasswordResetCompletedEvent) {
    await this.notificationsService.create({
      type: NotificationType.PASSWORD_RESET,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Password reset completed',
      body: 'Your password was changed successfully. If you did not perform this action, contact support immediately.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.email.verification.requested')
  async handleEmailVerificationRequested(
    event: EmailVerificationRequestedEvent,
  ) {
    await this.notificationsService.create({
      type: NotificationType.EMAIL_VERIFICATION,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [event.userId],
      subject: 'Verify your email address',
      body: 'Please verify your email address to complete account setup.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.email.verified')
  async handleEmailVerified(event: EmailVerifiedEvent) {
    await this.notificationsService.create({
      type: NotificationType.EMAIL_VERIFICATION,
      channels: [NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Email verified',
      body: 'Your email address has been verified successfully.',
      priority: NotificationPriority.NORMAL,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.phone.verification.requested')
  async handlePhoneVerificationRequested(
    event: PhoneVerificationRequestedEvent,
  ) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.SMS],
      recipientIds: [event.userId],
      body: 'Your phone verification code has been generated.',
      priority: NotificationPriority.HIGH,
      data: {
        phoneNumber: event.phoneNumber,
      },
    });
  }

  @OnEvent('auth.phone.verified')
  async handlePhoneVerified(event: PhoneVerifiedEvent) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      body: 'Your phone number has been verified successfully.',
      priority: NotificationPriority.NORMAL,
      data: {
        phoneNumber: event.phoneNumber,
      },
    });
  }

  @OnEvent('auth.login.warning-threshold-reached')
  async handleLoginWarningThresholdReached(
    event: LoginWarningThresholdReachedEvent,
  ) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Failed login attempts detected',
      body: `We detected ${event.failedAttempts} failed login attempts on your account. If this was not you, please take action immediately.`,
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
        failedAttempts: event.failedAttempts,
      },
    });
  }

  @OnEvent('auth.account.locked')
  async handleAccountLocked(event: AccountLockedEvent) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [
        NotificationChannel.EMAIL,
        NotificationChannel.IN_APP,
        NotificationChannel.SMS,
      ],
      recipientIds: [event.userId],
      subject: 'Account locked',
      body: event.lockedUntil
        ? `Your account has been locked until ${event.lockedUntil}.`
        : 'Your account has been locked due to security policy.',
      priority: NotificationPriority.CRITICAL,
      data: {
        email: event.email,
        lockedUntil: event.lockedUntil,
        reason: event.reason,
      },
    });
  }

  @OnEvent('auth.account.unlocked')
  async handleAccountUnlocked(event: AccountUnlockedEvent) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Account unlocked',
      body: 'Your account has been unlocked. You may sign in again.',
      priority: NotificationPriority.NORMAL,
      data: {
        email: event.email,
      },
    });
  }

  @OnEvent('auth.mfa.enabled')
  async handleMfaEnabled(event: MfaEnabledEvent) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Multi-factor authentication enabled',
      body: 'Multi-factor authentication has been enabled on your account.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
        method: event.method,
      },
    });
  }

  @OnEvent('auth.mfa.disabled')
  async handleMfaDisabled(event: MfaDisabledEvent) {
    await this.notificationsService.create({
      type: NotificationType.SYSTEM_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Multi-factor authentication disabled',
      body: 'Multi-factor authentication has been disabled on your account.',
      priority: NotificationPriority.HIGH,
      data: {
        email: event.email,
        method: event.method,
      },
    });
  }
}
