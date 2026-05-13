import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { Notification } from './entities/notification.entity';
import { NotificationEventsListener } from './listeners/notification-events.listener';
import { NotificationProcessor } from './processors/notification.processor';
import { EmailChannelService } from './services/channels/email-channel.service';
import { InAppChannelService } from './services/channels/inapp-channel.service';
import { PushChannelService } from './services/channels/push-channel.service';
import { SmsChannelService } from './services/channels/sms-channel.service';
import { WebsocketChannelService } from './services/channels/websocket-channel.service';
import {
  NOTIFICATION_QUEUE,
  NotificationDispatcherService,
} from './services/notification-dispatcher.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { WebsocketGateway } from './services/notification-websocket.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { HealthModule } from '../health/health.module';
import { LogSimulatorService } from './services/live-logs-simulation.service';

const ENTITIES = [
  Notification,
  NotificationRecipient,
  NotificationDelivery,
  NotificationTemplate,
  NotificationPreference,
  DeviceToken,
];

const CHANNEL_SERVICES = [
  EmailChannelService,
  SmsChannelService,
  PushChannelService,
  InAppChannelService,
  WebsocketChannelService,
];

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature(ENTITIES),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    HealthModule,
  ],
  controllers: [NotificationsController],
  providers: [
    // Core services
    NotificationsService,
    NotificationDispatcherService,
    NotificationTemplateService,
    NotificationPreferenceService,
    WebsocketGateway,
    // Channels
    ...CHANNEL_SERVICES,
    // Queue processor
    NotificationProcessor,
    // Event listeners
    NotificationEventsListener,
    LogSimulatorService,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationTemplateService,
    NotificationPreferenceService,
    WebsocketGateway,
  ],
})
export class NotificationsModule {
  constructor(private readonly simulator: LogSimulatorService) {
    if (process.env.ENABLE_LOG_SIMULATION === 'true') {
      this.simulator.startSimulation();
    }
  }
}
