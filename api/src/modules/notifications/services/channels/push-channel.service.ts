import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { DeviceToken } from '../../entities/device-token.entity';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { ChannelProvider } from '../../interfaces/channel-provider.interface';
import { RenderedNotification } from '../../interfaces/notification-payload.interface';
import { NotificationChannel } from '../../enums/notification-channel.enum';

@Injectable()
export class PushChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(PushChannelService.name);

  private firebaseApp?: App;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
    private readonly configService: ConfigService,
  ) {
    this.initFirebase();
  }

  isAvailable(): boolean {
    return !!this.firebaseApp;
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const attemptTime = new Date();

    if (!this.firebaseApp) {
      await this.markFailed(
        delivery,
        'Firebase Admin is not configured',
        attemptTime,
      );
      return;
    }

    const tokens = await this.deviceTokenRepo.find({
      where: {
        userId: delivery.recipientUserId,
        isActive: true,
      },
    });

    if (!tokens.length) {
      await this.markFailed(delivery, 'No active device tokens', attemptTime);
      return;
    }

    const registrationTokens = [
      ...new Set(tokens.map((t) => t.token).filter(Boolean)),
    ];

    if (!registrationTokens.length) {
      await this.markFailed(delivery, 'No valid device tokens', attemptTime);
      return;
    }

    try {
      const messaging = getMessaging(this.firebaseApp);

      const response = await messaging.sendEachForMulticast({
        tokens: registrationTokens.slice(0, 500),
        notification: {
          title: rendered.subject ?? 'New Notification',
          body: rendered.body,
        },
        data: this.toStringMap({
          notificationId: delivery.notificationId,
          deliveryId: delivery.id,
          ...(rendered.data ?? {}),
        }),
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
        webpush: {
          notification: {
            title: rendered.subject ?? 'New Notification',
            body: rendered.body,
          },
        },
      });

      const invalidTokens: string[] = [];

      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error?.code ?? '';
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(registrationTokens[index]);
          }
        }
      });

      if (invalidTokens.length) {
        await this.deviceTokenRepo.update(
          { token: In(invalidTokens) },
          { isActive: false },
        );
      }

      if (response.successCount > 0) {
        await this.deliveryRepo.update(delivery.id, {
          status: NotificationStatus.SENT,
          sentAt: attemptTime,
          deliveredAt: attemptTime,
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: attemptTime,
          externalId: `${response.successCount}/${registrationTokens.length}`,
          errorMessage:
            response.failureCount > 0
              ? `${response.failureCount} token(s) failed`
              : null,
        });

        this.logger.log(
          `Push sent for delivery=${delivery.id}, user=${delivery.recipientUserId}, success=${response.successCount}, failed=${response.failureCount}`,
        );
        return;
      }

      await this.markFailed(
        delivery,
        `All push sends failed for ${registrationTokens.length} token(s)`,
        attemptTime,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Firebase push error';

      await this.markFailed(delivery, message, attemptTime);
      this.logger.error(
        `Firebase push failed for delivery=${delivery.id}: ${message}`,
      );
      throw error;
    }
  }

  private initFirebase(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKeyRaw = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKeyRaw) {
      this.logger.warn('Firebase config missing. Push notifications disabled.');
      return;
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    if (getApps().length > 0) {
      this.firebaseApp = getApps()[0];
      return;
    }

    this.firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    this.logger.log('Firebase Admin initialized');
  }

  private toStringMap(input: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, String(value)]),
    );
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
