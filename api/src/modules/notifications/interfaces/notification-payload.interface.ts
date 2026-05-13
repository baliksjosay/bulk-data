import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';

export interface NotificationPayload {
  type: NotificationType;
  channels: NotificationChannel[];
  recipientIds: string[];
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  scheduledAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, string>;
}

export interface RenderedNotification {
  subject?: string;
  body: string;
  htmlBody?: string;
  data?: Record<string, unknown>;
}
