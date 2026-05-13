import { Injectable, NotFoundException } from '@nestjs/common';
import { UserPreference } from '../entities/user-preference.entity';
import { UserPreferenceRepository } from '../repositories/user-preference.repository';

@Injectable()
export class UserPreferencesService {
  constructor(
    private readonly preferenceRepository: UserPreferenceRepository,
  ) {}

  async getByUserId(userId: string): Promise<UserPreference> {
    const preference = await this.preferenceRepository.findByUserId(userId);
    if (!preference) {
      throw new NotFoundException(`Preferences not found for user ${userId}`);
    }
    return preference;
  }

  async ensureExists(userId: string): Promise<UserPreference> {
    const existing = await this.preferenceRepository.findByUserId(userId);
    if (existing) return existing;

    const preference = this.preferenceRepository.createDefault(userId);
    return this.preferenceRepository.save(preference);
  }

  async updateByUserId(
    userId: string,
    payload: Partial<UserPreference>,
  ): Promise<UserPreference> {
    await this.ensureExists(userId);
    await this.preferenceRepository.updateByUserId(userId, payload);
    return this.getByUserId(userId);
  }

  async updateNotificationPreferences(
    userId: string,
    payload: Partial<
      Pick<
        UserPreference,
        | 'emailNotifications'
        | 'pushNotifications'
        | 'inAppNotifications'
        | 'reportReadyAlerts'
        | 'systemAlerts'
        | 'userReminders'
      >
    >,
  ): Promise<UserPreference> {
    return this.updateByUserId(userId, payload);
  }

  async updateDisplayPreferences(
    userId: string,
    payload: Partial<Pick<UserPreference, 'language' | 'timezone' | 'theme'>>,
  ): Promise<UserPreference> {
    return this.updateByUserId(userId, payload);
  }

  async resetToDefaults(userId: string): Promise<UserPreference> {
    await this.ensureExists(userId);

    await this.preferenceRepository.updateByUserId(userId, {
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

    return this.getByUserId(userId);
  }
}
