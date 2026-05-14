import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../services/notifications.service';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';

// ---------------------------------------------------------------------------
// Domain event shapes (mirror your existing events module if it exists)
// ---------------------------------------------------------------------------
interface UserCreatedEvent {
  userId: string;
  email: string;
}
interface UserApprovedEvent {
  userId: string;
  adminUserId: string;
}
interface UserRejectedEvent {
  userId: string;
  adminUserId: string;
  reason?: string;
}
@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('user.created')
  async handleUserCreated(event: UserCreatedEvent) {
    await this.notificationsService.create({
      type: NotificationType.WELCOME,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.userId],
      subject: 'Welcome to Bulk Data Wholesale',
      body: 'Your account has been created. Please check your email to verify.',
      priority: NotificationPriority.HIGH,
    });
  }

  @OnEvent('user.approved')
  async handleUserApproved(event: UserApprovedEvent) {
    await this.notificationsService.create({
      type: NotificationType.USER_ACTIVATED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      recipientIds: [event.adminUserId],
      subject: 'User Account Approved',
      body: 'Your user registration has been approved. You can now log in.',
      priority: NotificationPriority.HIGH,
      userId: event.userId,
    });
  }

  @OnEvent('user.rejected')
  async handleUserRejected(event: UserRejectedEvent) {
    await this.notificationsService.create({
      type: NotificationType.ACCOUNT_REJECTED,
      channels: [NotificationChannel.EMAIL],
      recipientIds: [event.adminUserId],
      subject: 'User Registration Update',
      body: event.reason
        ? `Your registration was not approved: ${event.reason}`
        : 'Your user registration was not approved at this time.',
      priority: NotificationPriority.NORMAL,
    });
  }
}
