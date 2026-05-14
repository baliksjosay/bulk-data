import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationRecipient } from '../../entities/notification-recipient.entity';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { ChannelProvider } from '../../interfaces/channel-provider.interface';
import { RenderedNotification } from '../../interfaces/notification-payload.interface';
import { WebsocketChannelService } from './websocket-channel.service';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { WebsocketGateway } from '../notification-websocket.service';

@Injectable()
export class InAppChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.IN_APP;
  private readonly logger = new Logger(InAppChannelService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    private readonly wsChannel: WebsocketChannelService,
    @Optional()
    private readonly wsGateway?: WebsocketGateway,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    await this.recipientRepo.update(
      {
        notificationId: delivery.notificationId,
        userId: delivery.recipientUserId,
      },
      { status: NotificationStatus.DELIVERED },
    );

    await this.deliveryRepo.update(delivery.id, {
      status: NotificationStatus.DELIVERED,
      deliveredAt: new Date(),
      sentAt: new Date(),
      attemptCount: delivery.attemptCount + 1,
      lastAttemptAt: new Date(),
    });

    // Also push over WebSocket if the user is connected
    await this.wsChannel.send(delivery, rendered);

    if (this.wsGateway) {
      await this.wsGateway.sendUnreadCountUpdate(
        delivery.recipientUserId,
        await this.getUnreadCount(delivery.recipientUserId),
      );
    }
  }

  private async getUnreadCount(userId: string): Promise<number> {
    return this.recipientRepo
      .createQueryBuilder('r')
      .leftJoin('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .andWhere('r.readAt IS NULL')
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .getCount();
  }
}
