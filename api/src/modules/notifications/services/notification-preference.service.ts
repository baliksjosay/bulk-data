import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
  ) {}

  async getEnabledChannels(
    userId: string,
    type: NotificationType,
    requestedChannels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    const prefs = await this.prefRepo.find({ where: { userId, type } });

    if (!prefs.length) return requestedChannels;

    const prefMap = new Map(prefs.map((p) => [p.channel, p.enabled]));
    return requestedChannels.filter((ch) => prefMap.get(ch) !== false);
  }

  async upsert(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const existing = await this.prefRepo.findOne({ where: { userId, type, channel } });
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
}
