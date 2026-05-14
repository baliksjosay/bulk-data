import { MailerService } from '@nestjs-modules/mailer';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { EmailChannelService } from './email-channel.service';

describe('EmailChannelService', () => {
  const delivery = {
    id: 'delivery-1',
    channel: NotificationChannel.EMAIL,
    attemptCount: 0,
    recipient: {
      email: 'customer@example.com',
    },
  } as NotificationDelivery;

  let mailer: jest.Mocked<Pick<MailerService, 'sendMail'>>;
  let deliveryRepo: jest.Mocked<Pick<Repository<NotificationDelivery>, 'update'>>;
  let service: EmailChannelService;

  beforeEach(() => {
    mailer = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'message-1' }),
    };
    deliveryRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new EmailChannelService(
      mailer as unknown as MailerService,
      deliveryRepo as unknown as Repository<NotificationDelivery>,
    );
  });

  it('sends notification email with generated html when no html body is provided', async () => {
    await service.send(delivery, {
      subject: 'Your code',
      body: 'Use code <12345> to continue.',
    });

    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: 'Your code',
        text: 'Use code <12345> to continue.',
        html: '<p>Use code &lt;12345&gt; to continue.</p>',
      }),
    );
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: NotificationStatus.SENT,
        attemptCount: 1,
      }),
    );
  });

  it('marks delivery failed when recipient email is missing', async () => {
    await service.send(
      {
        ...delivery,
        recipient: {
          ...delivery.recipient,
          email: undefined,
        },
      },
      {
        subject: 'Your code',
        body: 'Use code 12345 to continue.',
      },
    );

    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: 'No recipient email address',
        attemptCount: 1,
      }),
    );
  });
});
