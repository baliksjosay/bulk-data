import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { ChannelProvider } from '../../interfaces/channel-provider.interface';
import { RenderedNotification } from '../../interfaces/notification-payload.interface';
import { NotificationChannel } from '../../enums/notification-channel.enum';
import { WebsocketGateway } from '../notification-websocket.service';

@Injectable()
export class WebsocketChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.WEBSOCKET;
  private readonly logger = new Logger(WebsocketChannelService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @Optional()
    private readonly wsService?: WebsocketGateway,
  ) {}

  isAvailable(): boolean {
    return !!this.wsService;
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const attemptTime = new Date();

    if (!this.wsService) {
      await this.markFailed(
        delivery,
        'WebSocket gateway unavailable',
        attemptTime,
      );
      return;
    }

    try {
      const payload = this.buildPayload(delivery, rendered, attemptTime);

      this.wsService.sendNotificationToUser(delivery.recipientUserId, payload);

      await this.deliveryRepo.update(delivery.id, {
        status: NotificationStatus.SENT,
        sentAt: attemptTime,
        lastAttemptAt: attemptTime,
        attemptCount: delivery.attemptCount + 1,
        errorMessage: null,
      });

      this.logger.debug(
        `WebSocket notification sent to user ${delivery.recipientUserId} for delivery ${delivery.id}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown WebSocket delivery error';

      await this.markFailed(delivery, message, attemptTime);

      this.logger.error(
        `Failed WebSocket delivery ${delivery.id} to user ${delivery.recipientUserId}: ${message}`,
      );

      throw error;
    }
  }

  private buildPayload(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
    timestamp: Date,
  ) {
    return {
      deliveryId: delivery.id,
      notificationId: delivery.notificationId,
      channel: this.channel,
      subject: rendered.subject ?? null,
      body: rendered.body,
      htmlBody: rendered.htmlBody ?? null,
      data: rendered.data ?? {},
      timestamp: timestamp.toISOString(),
    };
  }

  private async markFailed(
    delivery: NotificationDelivery,
    errorMessage: string,
    attemptTime: Date,
  ): Promise<void> {
    await this.deliveryRepo.update(delivery.id, {
      status: NotificationStatus.FAILED,
      errorMessage,
      lastAttemptAt: attemptTime,
      attemptCount: delivery.attemptCount + 1,
    });
  }
}
