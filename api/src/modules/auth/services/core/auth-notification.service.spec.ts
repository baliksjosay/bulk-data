import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NotificationsService } from '../../../notifications/services/notifications.service';
import { AuthNotificationService } from './auth-notification.service';

describe('AuthNotificationService', () => {
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs email MFA OTPs in development mode', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('development'),
    );

    await service.sendEmailOtpMfaRequested({
      userId: 'user-1',
      email: 'jo@example.com',
      challengeId: 'challenge-1',
      otp: '12345',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
    });

    expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(loggerWarnSpy.mock.calls[0][0]))).toEqual({
      event: 'development_otp_issued',
      purpose: 'mfa_email_otp',
      userId: 'user-1',
      challengeId: 'challenge-1',
      destination: 'jo**@example.com',
      otp: '12345',
      expiresAt: '2026-05-14T10:00:00.000Z',
    });
  });

  it('includes the MFA OTP in email notification content', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('production'),
    );

    await service.sendEmailOtpMfaRequested({
      userId: 'user-1',
      email: 'jo@example.com',
      otp: '12345',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your authentication code',
        body: expect.stringContaining('12345'),
        channels: ['email'],
        data: expect.not.objectContaining({ otp: expect.anything() }),
      }),
    );
  });

  it('does not log OTPs outside development mode', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('production'),
    );

    await service.sendEmailOtpMfaRequested({
      userId: 'user-1',
      email: 'jo@example.com',
      otp: '12345',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
    });

    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('labels SMS MFA OTP logs separately from phone verification OTP logs', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('development'),
    );

    await service.sendPhoneVerificationRequested({
      userId: 'user-1',
      phoneNumber: '+256789172796',
      challengeId: 'challenge-2',
      otp: '54321',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
      purpose: 'mfa_sms_otp',
    });

    expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(loggerWarnSpy.mock.calls[0][0]))).toEqual({
      event: 'development_otp_issued',
      purpose: 'mfa_sms_otp',
      userId: 'user-1',
      challengeId: 'challenge-2',
      destination: '********2796',
      otp: '54321',
      expiresAt: '2026-05-14T10:00:00.000Z',
    });
  });

  it('includes customer login OTP in email notification content', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('production'),
    );

    await service.sendCustomerLoginOtpRequested({
      userId: 'user-1',
      deliveryChannel: 'email',
      destination: 'jo@example.com',
      otp: '67890',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your sign-in code',
        body: expect.stringContaining('67890'),
        channels: ['email'],
        data: expect.not.objectContaining({ otp: expect.anything() }),
      }),
    );
  });

  it('formats OTP notifications for email and SMS one-time-code autofill', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('production'),
    );

    await service.sendCustomerActivationOtpRequested({
      userId: 'user-1',
      deliveryChannel: 'sms',
      destination: '+256789172796',
      otp: '24680',
      expiresAt: new Date('2026-05-14T10:00:00.000Z'),
    });

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('@bulkdata.mtn.co.ug #24680'),
        channels: ['sms'],
        data: expect.not.objectContaining({ otp: expect.anything() }),
      }),
    );
  });

  it('sends customer invitation by email and SMS with the activation link', async () => {
    const notificationsService = createNotificationsService();
    const service = new AuthNotificationService(
      notificationsService,
      createConfigService('production'),
    );

    await service.sendUserInvitation({
      userId: 'user-1',
      email: 'jo@example.com',
      phoneNumber: '+256789172796',
      firstName: 'Jo',
      activationUrl:
        'https://bulkdata.mtn.co.ug/auth/activate?token=activation-token',
      expiresAt: new Date('2026-05-16T10:00:00.000Z'),
    });

    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        subject: 'Activate your MTN Bulk Data account',
        body: expect.stringContaining(
          'https://bulkdata.mtn.co.ug/auth/activate?token=activation-token',
        ),
        channels: ['email'],
      }),
      undefined,
    );
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: expect.stringContaining(
          'https://bulkdata.mtn.co.ug/auth/activate?token=activation-token',
        ),
        channels: ['sms'],
      }),
      undefined,
    );
  });
});

function createNotificationsService(): NotificationsService {
  return {
    create: jest.fn().mockResolvedValue({}),
  } as unknown as NotificationsService;
}

function createConfigService(environment: string): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'app.env') {
        return environment;
      }

      if (key === 'auth.otpAutofillDomain') {
        return 'bulkdata.mtn.co.ug';
      }

      return defaultValue;
    }),
  } as unknown as ConfigService;
}
