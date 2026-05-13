import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { RenderedNotification } from '../interfaces/notification-payload.interface';

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
  ) {}

  async findByTypeAndChannel(
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate | null> {
    return this.templateRepo.findOne({ where: { type, channel, isActive: true } });
  }

  async render(
    templateId: string,
    variables: Record<string, string> = {},
  ): Promise<RenderedNotification> {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const interpolate = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);

    return {
      subject: template.subject ? interpolate(template.subject) : undefined,
      body: interpolate(template.bodyTemplate),
      htmlBody: template.htmlTemplate ? interpolate(template.htmlTemplate) : undefined,
    };
  }

  async findAll(): Promise<NotificationTemplate[]> {
    return this.templateRepo.find({ order: { type: 'ASC', channel: 'ASC' } });
  }
}
