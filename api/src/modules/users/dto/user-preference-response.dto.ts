import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserPreferenceResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Whether email notifications are enabled.',
    example: true,
  })
  emailNotifications: boolean;

  @Expose()
  @ApiProperty({
    description: 'Whether push notifications are enabled.',
    example: true,
  })
  pushNotifications: boolean;

  @Expose()
  @ApiProperty({
    description: 'Whether in-app notifications are enabled.',
    example: true,
  })
  inAppNotifications: boolean;

  @Expose()
  @ApiProperty({
    description: 'Whether report ready alerts are enabled.',
    example: true,
  })
  reportReadyAlerts: boolean;

  @Expose()
  @ApiProperty({
    description: 'Whether system alerts are enabled.',
    example: true,
  })
  systemAlerts: boolean;

  @Expose()
  @ApiProperty({
    description: 'Whether user reminders are enabled.',
    example: true,
  })
  userReminders: boolean;

  @Expose()
  @ApiProperty({
    description: 'Preferred user interface language.',
    example: 'en',
  })
  language: string;

  @Expose()
  @ApiProperty({
    description: 'Preferred timezone.',
    example: 'Africa/Kampala',
  })
  timezone: string;

  @Expose()
  @ApiProperty({
    description: 'Preferred application theme.',
    example: 'light',
  })
  theme: string;
}
