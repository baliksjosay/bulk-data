import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from 'src/modules/users/entities/user-preference.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';

interface NotificationPreferenceContext {
  priority?: NotificationPriority;
  data?: Record<string, unknown> | null;
}

interface QuietHoursPreference {
  enabled?: unknown;
  start?: unknown;
  end?: unknown;
}

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
    @InjectRepository(UserPreference)
    private readonly userPreferenceRepo: Repository<UserPreference>,
  ) {}

  async getEnabledChannels(
    userId: string,
    type: NotificationType,
    requestedChannels: NotificationChannel[],
    context?: NotificationPreferenceContext,
  ): Promise<NotificationChannel[]> {
    if (this.shouldBypassUserPreferences(context)) {
      return requestedChannels;
    }

    const [prefs, userPreference] = await Promise.all([
      this.prefRepo.find({ where: { userId, type } }),
      this.userPreferenceRepo.findOne({ where: { userId } }),
    ]);

    const prefMap = new Map(prefs.map((p) => [p.channel, p.enabled]));

    return requestedChannels.filter(
      (channel) =>
        prefMap.get(channel) !== false &&
        this.isEnabledForUserPreference(userPreference, type, channel),
    );
  }

  async getDeliveryDelayMs(
    userId: string,
    requestedAt: Date,
    context?: NotificationPreferenceContext,
  ): Promise<number> {
    if (this.shouldBypassQuietHours(context)) {
      return Math.max(0, requestedAt.getTime() - Date.now());
    }

    const userPreference = await this.userPreferenceRepo.findOne({
      where: { userId },
    });
    const quietHours = this.getQuietHours(userPreference);

    if (!quietHours) {
      return Math.max(0, requestedAt.getTime() - Date.now());
    }

    const effectiveAtMs = Math.max(requestedAt.getTime(), Date.now());
    const effectiveAt = new Date(effectiveAtMs);
    const localMinute = this.getLocalMinute(
      effectiveAt,
      userPreference?.timezone ?? 'Africa/Kampala',
    );
    const startMinute = this.parseTimeToMinute(quietHours.start);
    const endMinute = this.parseTimeToMinute(quietHours.end);

    if (
      startMinute === null ||
      endMinute === null ||
      !this.isWithinQuietHours(localMinute, startMinute, endMinute)
    ) {
      return Math.max(0, effectiveAtMs - Date.now());
    }

    return Math.max(
      0,
      effectiveAtMs -
        Date.now() +
        this.minutesUntilQuietHoursEnd(localMinute, startMinute, endMinute) *
          60_000,
    );
  }

  async upsert(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const existing = await this.prefRepo.findOne({
      where: { userId, type, channel },
    });
    if (existing) {
      await this.prefRepo.update(existing.id, { enabled });
      return { ...existing, enabled };
    }
    const pref = this.prefRepo.create({ userId, type, channel, enabled });
    return this.prefRepo.save(pref);
  }

  async findForUser(userId: string): Promise<NotificationPreference[]> {
    return this.prefRepo.find({ where: { userId } });
  }

  private shouldBypassUserPreferences(
    context?: NotificationPreferenceContext,
  ): boolean {
    return (
      this.shouldBypassQuietHours(context) ||
      context?.priority === NotificationPriority.CRITICAL
    );
  }

  private shouldBypassQuietHours(
    context?: NotificationPreferenceContext,
  ): boolean {
    return (
      context?.priority === NotificationPriority.CRITICAL ||
      context?.data?.containsSensitiveCode === true
    );
  }

  private isEnabledForUserPreference(
    preference: UserPreference | null,
    type: NotificationType,
    channel: NotificationChannel,
  ): boolean {
    if (!preference) {
      return true;
    }

    if (!this.isNotificationTypeEnabled(preference, type)) {
      return false;
    }

    if (channel === NotificationChannel.EMAIL) {
      return preference.emailNotifications !== false;
    }

    if (channel === NotificationChannel.PUSH) {
      return preference.pushNotifications !== false;
    }

    if (
      channel === NotificationChannel.IN_APP ||
      channel === NotificationChannel.WEBSOCKET
    ) {
      return preference.inAppNotifications !== false;
    }

    if (channel === NotificationChannel.SMS) {
      return this.getDashboardBoolean(preference, 'smsNotifications') !== false;
    }

    return true;
  }

  private isNotificationTypeEnabled(
    preference: UserPreference,
    type: NotificationType,
  ): boolean {
    if (
      (type === NotificationType.REPORT_READY ||
        type === NotificationType.WEEKLY_SUMMARY) &&
      preference.reportReadyAlerts === false
    ) {
      return false;
    }

    if (
      (type === NotificationType.SYSTEM_ALERT ||
        type === NotificationType.DEVICE_LIMIT_WARNING) &&
      preference.systemAlerts === false
    ) {
      return false;
    }

    return true;
  }

  private getQuietHours(
    preference: UserPreference | null,
  ): { start: string; end: string } | null {
    const quietHours = this.getDashboardRecord(
      preference,
      'quietHours',
    ) as QuietHoursPreference | null;

    if (
      !quietHours ||
      quietHours.enabled !== true ||
      typeof quietHours.start !== 'string' ||
      typeof quietHours.end !== 'string'
    ) {
      return null;
    }

    return {
      start: quietHours.start,
      end: quietHours.end,
    };
  }

  private getDashboardBoolean(
    preference: UserPreference,
    key: string,
  ): boolean | undefined {
    const value = preference.dashboardPreferences?.[key];
    return typeof value === 'boolean' ? value : undefined;
  }

  private getDashboardRecord(
    preference: UserPreference | null,
    key: string,
  ): Record<string, unknown> | null {
    const value = preference?.dashboardPreferences?.[key];
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private parseTimeToMinute(value: string): number | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) {
      return null;
    }

    return hour * 60 + minute;
  }

  private getLocalMinute(date: Date, timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const hour = Number(
        parts.find((part) => part.type === 'hour')?.value ?? '0',
      );
      const minute = Number(
        parts.find((part) => part.type === 'minute')?.value ?? '0',
      );

      return hour * 60 + minute;
    } catch {
      this.logger.warn(
        `Invalid user timezone "${timezone}" for quiet-hours calculation`,
      );

      return date.getUTCHours() * 60 + date.getUTCMinutes();
    }
  }

  private isWithinQuietHours(
    minute: number,
    startMinute: number,
    endMinute: number,
  ): boolean {
    if (startMinute === endMinute) {
      return false;
    }

    if (startMinute < endMinute) {
      return minute >= startMinute && minute < endMinute;
    }

    return minute >= startMinute || minute < endMinute;
  }

  private minutesUntilQuietHoursEnd(
    minute: number,
    startMinute: number,
    endMinute: number,
  ): number {
    if (startMinute < endMinute) {
      return endMinute - minute;
    }

    return minute < endMinute ? endMinute - minute : 1440 - minute + endMinute;
  }
}
