import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { SmsChannelService } from './sms-channel.service';

type ConfigValue = string | boolean | undefined;

describe('SmsChannelService', () => {
  const delivery = {
    id: 'delivery-1',
    channel: NotificationChannel.SMS,
    attemptCount: 0,
    recipient: {
      phoneNumber: '+256771234567',
    },
  } as NotificationDelivery;

  const mtnConfig = {
    'app.env': 'production',
    'sms.provider': 'mtn_sms',
    'sms.mtn.baseUrl': 'https://sms.mtn.example/send',
    'sms.mtn.username': 'mtn-user',
    'sms.mtn.password': 'mtn-password',
    'sms.mtn.senderId': 'MTNBULK',
  } satisfies Record<string, ConfigValue>;

  let httpService: jest.Mocked<Pick<HttpService, 'get'>>;
  let deliveryRepo: jest.Mocked<
    Pick<Repository<NotificationDelivery>, 'update'>
  >;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    httpService = {
      get: jest.fn().mockReturnValue(
        of({
          data: {
            messageId: 'mtn-message-1',
            status: 'Submitted',
          },
          status: 200,
        }),
      ),
    };
    deliveryRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(configValues: Record<string, ConfigValue>) {
    const configService = {
      get: jest.fn((key: string, defaultValue?: ConfigValue) => {
        return configValues[key] ?? defaultValue;
      }),
    };

    return new SmsChannelService(
      deliveryRepo as unknown as Repository<NotificationDelivery>,
      configService as unknown as ConfigService,
      httpService as unknown as HttpService,
    );
  }

  it('sends production SMS through the MTN gateway', async () => {
    const service = createService(mtnConfig);

    await service.send(delivery, {
      body: 'Your MTN Bulk Data verification code is 12345',
    });

    expect(service.isAvailable()).toBe(true);
    expect(httpService.get).toHaveBeenCalledWith(
      'https://sms.mtn.example/send',
      {
        params: {
          username: 'mtn-user',
          password: 'mtn-password',
          to: '+256771234567',
          from: 'MTNBULK',
          text: 'Your MTN Bulk Data verification code is 12345',
        },
      },
    );
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: NotificationStatus.SENT,
        attemptCount: 1,
        externalId: 'mtn-message-1',
        errorMessage: 'Submitted',
      }),
    );
  });

  it('marks delivery failed when MTN gateway configuration is incomplete', async () => {
    const service = createService({
      ...mtnConfig,
      'sms.mtn.password': '',
    });

    await service.send(delivery, {
      body: 'Your MTN Bulk Data verification code is 12345',
    });

    expect(httpService.get).not.toHaveBeenCalled();
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: 'MTN SMS Gateway is not configured',
        attemptCount: 1,
      }),
    );
  });

  it("keeps Africa's Talking unavailable in production", () => {
    const service = createService({
      'app.env': 'production',
      'sms.provider': 'africastalking',
      'sms.africastalking.username': 'sandbox',
      'sms.africastalking.apiKey': 'dev-api-key',
      'sms.africastalking.senderId': 'MTNBULK',
      'sms.africastalking.enqueue': true,
    });

    expect(service.isAvailable()).toBe(false);
  });

  it('redacts SMS provider credentials from failure details', async () => {
    const service = createService(mtnConfig);

    httpService.get.mockReturnValueOnce(
      throwError(() => new Error('Gateway rejected mtn-user mtn-password')),
    );

    await expect(
      service.send(delivery, {
        body: 'Your MTN Bulk Data verification code is 12345',
      }),
    ).rejects.toThrow('Gateway rejected mtn-user mtn-password');

    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: 'Gateway rejected [redacted] [redacted]',
      }),
    );
  });
});
