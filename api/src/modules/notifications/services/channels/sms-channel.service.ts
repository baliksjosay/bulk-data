import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AfricasTalking from 'africastalking';

import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { ChannelProvider } from '../../interfaces/channel-provider.interface';
import { RenderedNotification } from '../../interfaces/notification-payload.interface';
import { NotificationChannel } from '../../enums/notification-channel.enum';

type AfricasTalkingSmsService = {
  send: (options: {
    to: string | string[];
    message: string;
    senderId?: string;
    enqueue?: boolean;
  }) => Promise<any>;
};

@Injectable()
export class SmsChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger(SmsChannelService.name);

  private readonly smsService?: AfricasTalkingSmsService;
  private readonly username?: string;
  private readonly apiKey?: string;
  private readonly senderId?: string;
  private readonly enqueue: boolean;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    private readonly configService: ConfigService,
  ) {
    this.username = this.configService.get<string>('africastalking.username');
    this.apiKey = this.configService.get<string>('africastalking.apiKey');
    this.senderId = this.configService.get<string>('africastalking.senderId');
    this.enqueue =
      this.configService.get<string>('africastalking.enqueue') === 'true';

    if (this.username && this.apiKey) {
      const at = AfricasTalking({
        username: this.username,
        apiKey: this.apiKey,
      });

      this.smsService = at.SMS;
    }
  }

  isAvailable(): boolean {
    return !!this.smsService && !!this.username && !!this.apiKey;
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const attemptTime = new Date();

    if (!this.smsService) {
      await this.markFailed(
        delivery,
        "Africa's Talking SMS is not configured",
        attemptTime,
      );
      return;
    }

    const rawPhone = delivery.recipient?.phoneNumber;
    const phone = this.normalizePhoneNumber(rawPhone);
    const message = this.buildMessage(rendered);

    if (!phone) {
      await this.markFailed(
        delivery,
        'No valid recipient phone number',
        attemptTime,
      );
      return;
    }

    if (!message) {
      await this.markFailed(delivery, 'SMS message body is empty', attemptTime);
      return;
    }

    try {
      const response = await this.smsService.send({
        to: [phone],
        message,
        senderId: this.senderId || undefined,
        enqueue: this.enqueue,
      });

      const providerMessageId = this.extractProviderMessageId(response);
      const providerStatus = this.extractProviderStatus(response);

      await this.deliveryRepo.update(delivery.id, {
        status: NotificationStatus.SENT,
        sentAt: attemptTime,
        lastAttemptAt: attemptTime,
        attemptCount: delivery.attemptCount + 1,
        externalId: providerMessageId ?? null,
        errorMessage: providerStatus ?? null,
      });

      this.logger.log(
        `SMS sent via Africa's Talking to ${phone}. delivery=${delivery.id} providerMessageId=${providerMessageId ?? 'n/a'}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Africa's Talking SMS error";

      await this.markFailed(delivery, message, attemptTime);

      this.logger.error(
        `Failed to send SMS via Africa's Talking. delivery=${delivery.id} phone=${phone} error=${message}`,
      );

      throw error;
    }
  }

  private buildMessage(rendered: RenderedNotification): string {
    return (rendered.body || '').trim();
  }

  private normalizePhoneNumber(phone?: string | null): string | null {
    if (!phone) return null;

    let normalized = phone.trim().replace(/\s+/g, '');

    if (!normalized) return null;

    if (normalized.startsWith('00')) {
      normalized = `+${normalized.slice(2)}`;
    }

    if (!normalized.startsWith('+')) {
      return null;
    }

    return normalized;
  }

  private extractProviderMessageId(response: any): string | null {
    const recipients = response?.SMSMessageData?.Recipients;
    if (Array.isArray(recipients) && recipients.length > 0) {
      return recipients[0]?.messageId ?? null;
    }
    return null;
  }

  private extractProviderStatus(response: any): string | null {
    const recipients = response?.SMSMessageData?.Recipients;
    if (Array.isArray(recipients) && recipients.length > 0) {
      return recipients[0]?.status ?? null;
    }
    return response?.SMSMessageData?.Message ?? null;
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
