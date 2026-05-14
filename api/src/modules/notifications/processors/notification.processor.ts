import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { EmailChannelService } from '../services/channels/email-channel.service';
import { InAppChannelService } from '../services/channels/inapp-channel.service';
import { PushChannelService } from '../services/channels/push-channel.service';
import { SmsChannelService } from '../services/channels/sms-channel.service';
import { WebsocketChannelService } from '../services/channels/websocket-channel.service';
import { NOTIFICATION_QUEUE } from '../services/notification-dispatcher.service';
import { NotificationTemplateService } from '../services/notification-template.service';
import { ChannelProvider } from '../interfaces/channel-provider.interface';
import { RenderedNotification } from '../interfaces/notification-payload.interface';

interface SendNotificationJobData {
  deliveryId: string;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly channelMap: Map<NotificationChannel, ChannelProvider>;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    private readonly templateService: NotificationTemplateService,
    emailChannel: EmailChannelService,
    smsChannel: SmsChannelService,
    pushChannel: PushChannelService,
    inAppChannel: InAppChannelService,
    wsChannel: WebsocketChannelService,
  ) {
    super();

    this.channelMap = new Map<NotificationChannel, ChannelProvider>([
      [NotificationChannel.EMAIL, emailChannel],
      [NotificationChannel.SMS, smsChannel],
      [NotificationChannel.PUSH, pushChannel],
      [NotificationChannel.IN_APP, inAppChannel],
      [NotificationChannel.WEBSOCKET, wsChannel],
    ]);
  }

  async process(job: Job<SendNotificationJobData>): Promise<void> {
    const { deliveryId } = job.data;

    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['notification', 'recipient'],
    });

    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found`);
      return;
    }

    if (delivery.status === NotificationStatus.SENT) {
      this.logger.debug(`Delivery ${deliveryId} already sent — skipping`);
      return;
    }

    const provider = this.channelMap.get(delivery.channel);
    if (!provider || !provider.isAvailable()) {
      await this.deliveryRepo.update(deliveryId, {
        status: NotificationStatus.FAILED,
        errorMessage: `Channel ${delivery.channel} unavailable`,
        lastAttemptAt: new Date(),
      });
      return;
    }

    const notification = delivery.notification;

    let rendered: RenderedNotification = {
      subject: notification.subject,
      body: notification.body,
      data: notification.data,
    };

    if (notification.templateId) {
      rendered = await this.templateService.render(
        notification.templateId,
        notification.templateVariables,
      );
    }

    await provider.send(delivery, rendered);
    this.logger.log(`Delivery ${deliveryId} sent via ${delivery.channel}`);
  }
}
