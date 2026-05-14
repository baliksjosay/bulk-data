import { Repository } from 'typeorm';
import { UserPreference } from 'src/modules/users/entities/user-preference.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPreferenceService } from './notification-preference.service';

type MockRepository<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createRepositoryMock<T>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

function createUserPreference(
  payload: Partial<UserPreference> = {},
): UserPreference {
  return {
    id: 'pref-1',
    userId: 'user-1',
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    reportReadyAlerts: true,
    systemAlerts: true,
    userReminders: true,
    language: 'en',
    timezone: 'UTC',
    theme: 'light',
    dashboardPreferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...payload,
  } as UserPreference;
}

describe(NotificationPreferenceService.name, () => {
  let notificationPreferenceRepo: MockRepository<NotificationPreference>;
  let userPreferenceRepo: MockRepository<UserPreference>;
  let service: NotificationPreferenceService;

  beforeEach(() => {
    notificationPreferenceRepo = createRepositoryMock<NotificationPreference>();
    userPreferenceRepo = createRepositoryMock<UserPreference>();
    service = new NotificationPreferenceService(
      notificationPreferenceRepo as unknown as Repository<NotificationPreference>,
      userPreferenceRepo as unknown as Repository<UserPreference>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filters requested channels through persisted user preferences', async () => {
    notificationPreferenceRepo.find?.mockResolvedValue([]);
    userPreferenceRepo.findOne?.mockResolvedValue(
      createUserPreference({
        emailNotifications: false,
        inAppNotifications: true,
        dashboardPreferences: {
          smsNotifications: false,
        },
      }),
    );

    await expect(
      service.getEnabledChannels('user-1', NotificationType.REPORT_READY, [
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.IN_APP,
      ]),
    ).resolves.toEqual([NotificationChannel.IN_APP]);
  });

  it('defers non-critical notifications until quiet hours end', async () => {
    const requestedAt = new Date('2026-05-14T21:30:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(requestedAt.getTime());
    userPreferenceRepo.findOne?.mockResolvedValue(
      createUserPreference({
        timezone: 'UTC',
        dashboardPreferences: {
          quietHours: {
            enabled: true,
            start: '20:00',
            end: '07:00',
          },
        },
      }),
    );

    await expect(
      service.getDeliveryDelayMs('user-1', requestedAt, {
        priority: NotificationPriority.NORMAL,
        data: {},
      }),
    ).resolves.toBe(570 * 60_000);
  });

  it('does not defer sensitive authentication codes during quiet hours', async () => {
    const requestedAt = new Date('2026-05-14T21:30:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(requestedAt.getTime());

    await expect(
      service.getDeliveryDelayMs('user-1', requestedAt, {
        priority: NotificationPriority.HIGH,
        data: { containsSensitiveCode: true },
      }),
    ).resolves.toBe(0);
    expect(userPreferenceRepo.findOne).not.toHaveBeenCalled();
  });
});
