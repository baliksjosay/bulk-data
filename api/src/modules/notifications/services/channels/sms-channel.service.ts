import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
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
  }) => Promise<unknown>;
};

type SmsProviderName = 'mtn_sms' | 'africastalking';

type MtnSmsConfig = {
  baseUrl: string;
  username: string;
  password: string;
  senderId: string;
};

type AfricasTalkingConfig = {
  username: string;
  apiKey: string;
  senderId: string;
  enqueue: boolean;
};

type SmsProviderResult = {
  providerName: string;
  externalId: string | null;
  status: string | null;
};

@Injectable()
export class SmsChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger(SmsChannelService.name);

  private readonly provider: SmsProviderName;
  private readonly appEnv: string;
  private readonly africasTalkingService?: AfricasTalkingSmsService;
  private readonly africasTalkingConfig: AfricasTalkingConfig;
  private readonly mtnConfig: MtnSmsConfig;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.provider = this.configService.get<SmsProviderName>(
      'sms.provider',
      'mtn_sms',
    );
    this.appEnv = this.configService.get<string>('app.env', 'development');
    this.mtnConfig = {
      baseUrl: this.configService.get<string>('sms.mtn.baseUrl', ''),
      username: this.configService.get<string>('sms.mtn.username', ''),
      password: this.configService.get<string>('sms.mtn.password', ''),
      senderId: this.configService.get<string>('sms.mtn.senderId', ''),
    };
    this.africasTalkingConfig = {
      username: this.configService.get<string>(
        'sms.africastalking.username',
        '',
      ),
      apiKey: this.configService.get<string>('sms.africastalking.apiKey', ''),
      senderId: this.configService.get<string>(
        'sms.africastalking.senderId',
        '',
      ),
      enqueue: this.configService.get<boolean>(
        'sms.africastalking.enqueue',
        false,
      ),
    };

    if (
      this.provider === 'africastalking' &&
      this.appEnv !== 'production' &&
      this.africasTalkingConfig.username &&
      this.africasTalkingConfig.apiKey
    ) {
      const at = AfricasTalking({
        username: this.africasTalkingConfig.username,
        apiKey: this.africasTalkingConfig.apiKey,
      });

      this.africasTalkingService = at.SMS;
    }
  }

  isAvailable(): boolean {
    if (this.provider === 'mtn_sms') {
      return Boolean(
        this.mtnConfig.baseUrl &&
        this.mtnConfig.username &&
        this.mtnConfig.password &&
        this.mtnConfig.senderId,
      );
    }

    return Boolean(
      this.appEnv !== 'production' &&
      this.africasTalkingService &&
      this.africasTalkingConfig.username &&
      this.africasTalkingConfig.apiKey,
    );
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const attemptTime = new Date();

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

    if (!this.isAvailable()) {
      await this.markFailed(
        delivery,
        this.getUnavailableMessage(),
        attemptTime,
      );
      return;
    }

    try {
      const result =
        this.provider === 'mtn_sms'
          ? await this.sendMtnSms(phone, message)
          : await this.sendAfricasTalkingSms(phone, message);

      await this.deliveryRepo.update(delivery.id, {
        status: NotificationStatus.SENT,
        sentAt: attemptTime,
        lastAttemptAt: attemptTime,
        attemptCount: delivery.attemptCount + 1,
        externalId: result.externalId,
        errorMessage: result.status,
      });

      this.logger.log(
        `SMS sent via ${result.providerName}. delivery=${delivery.id} recipient=${this.maskPhoneNumber(phone)} providerMessageId=${result.externalId ?? 'n/a'}`,
      );
    } catch (error) {
      const errorMessage = this.sanitizeErrorMessage(
        error instanceof Error
          ? error.message
          : `Unknown ${this.getProviderLabel()} SMS error`,
      );

      await this.markFailed(delivery, errorMessage, attemptTime);

      this.logger.error(
        `Failed to send SMS via ${this.getProviderLabel()}. delivery=${delivery.id} recipient=${this.maskPhoneNumber(phone)} error=${errorMessage}`,
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

  private async sendMtnSms(
    phone: string,
    message: string,
  ): Promise<SmsProviderResult> {
    const response = await firstValueFrom(
      this.httpService.get<unknown>(this.mtnConfig.baseUrl, {
        params: {
          username: this.mtnConfig.username,
          password: this.mtnConfig.password,
          to: phone,
          from: this.mtnConfig.senderId,
          text: message,
        },
      }),
    );

    return {
      providerName: 'MTN SMS Gateway',
      externalId: this.extractMtnProviderMessageId(response.data),
      status:
        this.extractMtnProviderStatus(response.data) ??
        `HTTP ${response.status}`,
    };
  }

  private async sendAfricasTalkingSms(
    phone: string,
    message: string,
  ): Promise<SmsProviderResult> {
    if (!this.africasTalkingService) {
      throw new Error("Africa's Talking SMS is not configured");
    }

    const response = await this.africasTalkingService.send({
      to: [phone],
      message,
      senderId: this.africasTalkingConfig.senderId || undefined,
      enqueue: this.africasTalkingConfig.enqueue,
    });

    return {
      providerName: "Africa's Talking",
      externalId: this.extractAfricasTalkingMessageId(response),
      status: this.extractAfricasTalkingStatus(response),
    };
  }

  private extractAfricasTalkingMessageId(response: unknown): string | null {
    const data = this.asRecord(this.asRecord(response)?.SMSMessageData);
    const recipients = data?.Recipients;

    if (Array.isArray(recipients) && recipients.length > 0) {
      return this.readString(this.asRecord(recipients[0]), ['messageId']);
    }

    return null;
  }

  private extractAfricasTalkingStatus(response: unknown): string | null {
    const data = this.asRecord(this.asRecord(response)?.SMSMessageData);
    const recipients = data?.Recipients;

    if (Array.isArray(recipients) && recipients.length > 0) {
      return this.readString(this.asRecord(recipients[0]), ['status']);
    }

    return this.readString(data, ['Message']);
  }

  private extractMtnProviderMessageId(response: unknown): string | null {
    const data = this.asRecord(response);

    return this.readString(data, [
      'messageId',
      'messageID',
      'id',
      'requestId',
      'referenceId',
      'reference',
      'transactionId',
    ]);
  }

  private extractMtnProviderStatus(response: unknown): string | null {
    if (typeof response === 'string' && response.trim()) {
      return response.trim();
    }

    const data = this.asRecord(response);

    return this.readString(data, ['status', 'message', 'Message', 'result']);
  }

  private getUnavailableMessage(): string {
    if (this.provider === 'africastalking' && this.appEnv === 'production') {
      return "Africa's Talking SMS is only available outside production";
    }

    return `${this.getProviderLabel()} is not configured`;
  }

  private getProviderLabel(): string {
    return this.provider === 'mtn_sms' ? 'MTN SMS Gateway' : "Africa's Talking";
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 7) {
      return '***';
    }

    return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
  }

  private sanitizeErrorMessage(message: string): string {
    const sensitiveValues = [
      this.mtnConfig.username,
      this.mtnConfig.password,
      this.africasTalkingConfig.username,
      this.africasTalkingConfig.apiKey,
    ].filter(Boolean);

    return sensitiveValues.reduce(
      (sanitized, value) => sanitized.split(value).join('[redacted]'),
      message,
    );
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private readString(
    record: Record<string, unknown> | null,
    keys: string[],
  ): string | null {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const value = record[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number') {
        return value.toString();
      }
    }

    return null;
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
