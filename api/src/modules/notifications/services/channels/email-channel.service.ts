import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDelivery } from '../../entities/notification-delivery.entity';
import { NotificationStatus } from '../../enums/notification-status.enum';
import { ChannelProvider } from '../../interfaces/channel-provider.interface';
import { RenderedNotification } from '../../interfaces/notification-payload.interface';
import { NotificationChannel } from '../../enums/notification-channel.enum';

@Injectable()
export class EmailChannelService implements ChannelProvider {
  readonly channel = NotificationChannel.EMAIL;
  private readonly logger = new Logger(EmailChannelService.name);

  constructor(
    private readonly mailer: MailerService,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async send(
    delivery: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const recipientEmail = delivery.recipient?.email;
    if (!recipientEmail) {
      await this.fail(delivery, 'No recipient email address');
      return;
    }

    try {
      await this.mailer.sendMail({
        to: recipientEmail,
        subject: rendered.subject ?? 'Bulk Data Wholesale Notification',
        text: rendered.body,
        html: rendered.htmlBody ?? this.renderPlainTextHtml(rendered.body),
      });
      await this.deliveryRepo.update(delivery.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        attemptCount: delivery.attemptCount + 1,
        lastAttemptAt: new Date(),
      });
      this.logger.log(
        JSON.stringify({
          event: 'notification_delivery',
          channel: this.channel,
          deliveryId: delivery.id,
          outcome: 'sent',
        }),
      );
    } catch (error) {
      await this.fail(delivery, (error as Error).message);
      this.logger.error(
        JSON.stringify({
          event: 'notification_delivery',
          channel: this.channel,
          deliveryId: delivery.id,
          outcome: 'failed',
          reason:
            error instanceof Error ? error.message : 'email_delivery_failed',
        }),
        (error as Error).stack,
      );
      throw error;
    }
  }

  private renderPlainTextHtml(body: string): string {
    const html = body
      .split(/\r?\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${this.escapeHtml(paragraph)}</p>`)
      .join('');

    return html || '<p></p>';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async fail(
    delivery: NotificationDelivery,
    message: string,
  ): Promise<void> {
    await this.deliveryRepo.update(delivery.id, {
      status: NotificationStatus.FAILED,
      errorMessage: message,
      attemptCount: delivery.attemptCount + 1,
      lastAttemptAt: new Date(),
    });
  }
}
