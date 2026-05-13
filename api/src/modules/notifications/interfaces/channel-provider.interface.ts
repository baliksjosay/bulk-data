import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { RenderedNotification } from './notification-payload.interface';

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void>;
  isAvailable(): boolean;
}
