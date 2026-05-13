import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../entities/user-preference.entity';

@Injectable()
export class UserPreferenceRepository {
  constructor(
    @InjectRepository(UserPreference)
    private readonly repo: Repository<UserPreference>,
  ) {}

  create(payload: Partial<UserPreference>): UserPreference {
    return this.repo.create(payload);
  }

  createDefault(userId?: string): UserPreference {
    return this.repo.create({
      userId,
      emailNotifications: true,
      pushNotifications: true,
      inAppNotifications: true,
      reportReadyAlerts: true,
      systemAlerts: true,
      userReminders: true,
      language: 'en',
      timezone: 'Africa/Kampala',
      theme: 'light',
      dashboardPreferences: null,
    });
  }

  save(preference: UserPreference): Promise<UserPreference> {
    return this.repo.save(preference);
  }

  findByUserId(userId: string): Promise<UserPreference | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async updateByUserId(
    userId: string,
    payload: Partial<UserPreference>,
  ): Promise<void> {
    await this.repo.update({ userId }, payload);
  }
}
