import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationPreferenceService } from './notification-preference.service';

export const NOTIFICATION_QUEUE = 'notifications';

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  async dispatch(notificationId: string): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
      relations: ['recipients'],
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found for dispatch`);
      return;
    }

    for (const recipient of notification.recipients) {
      const enabledChannels = await this.preferenceService.getEnabledChannels(
        recipient.userId,
        notification.type,
        notification['channels'] ?? [],
      );

      for (const channel of enabledChannels) {
        const delivery = this.deliveryRepo.create({
          notificationId: notification.id,
          notificationRecipientId: recipient.id,
          recipientUserId: recipient.userId,
          channel,
          status: NotificationStatus.QUEUED,
        });
        const saved = await this.deliveryRepo.save(delivery);

        await this.queue.add(
          'send-notification',
          { deliveryId: saved.id },
          {
            priority: this.mapPriority(notification.priority),
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            delay: notification.scheduledAt
              ? Math.max(0, notification.scheduledAt.getTime() - Date.now())
              : 0,
          },
        );
      }
    }

    await this.notificationRepo.update(notificationId, {
      status: NotificationStatus.QUEUED,
    });
  }

  private mapPriority(priority?: string): number {
    const map: Record<string, number> = {
      critical: 1,
      high: 5,
      normal: 10,
      low: 20,
    };
    return map[priority ?? 'normal'] ?? 10;
  }
}
