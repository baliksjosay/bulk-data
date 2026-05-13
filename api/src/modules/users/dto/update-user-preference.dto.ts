import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserPreferenceDto {
  @ApiPropertyOptional({
    description: 'Enable or disable email notifications.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable push notifications.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable in-app notifications.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable report ready alerts.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  reportReadyAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable system alerts.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  systemAlerts?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable user reminders.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  userReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred language code.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'Preferred timezone.',
    example: 'Africa/Kampala',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Preferred UI theme.',
    example: 'light',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @ApiPropertyOptional({
    description: 'Dashboard-specific preferences.',
    example: { defaultDateRange: '30d', compactMode: true },
  })
  @IsOptional()
  @IsObject()
  dashboardPreferences?: Record<string, any>;
}
