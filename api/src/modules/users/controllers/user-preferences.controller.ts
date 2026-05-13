import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { UserPreferencesService } from '../services/user-preferences.service';
import { UserPreferenceResponseDto } from '../dto/user-preference-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserPreferenceDto } from '../dto/update-user-preference.dto';

@ApiTags('User Preferences')
@ApiBearerAuth()
@Controller('users/me/preferences')
export class UserPreferencesController {
  constructor(
    private readonly userPreferencesService: UserPreferencesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user preferences',
    description: 'Returns the authenticated user preference settings.',
  })
  @ApiOkResponse({
    description: 'User preferences retrieved successfully.',
    type: UserPreferenceResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getMyPreferences(
    @CurrentUser('id') userId: string,
  ): Promise<UserPreferenceResponseDto> {
    const prefs = await this.userPreferencesService.getByUserId(userId);
    return plainToInstance(UserPreferenceResponseDto, prefs, {
      excludeExtraneousValues: true,
    });
  }

  @Patch()
  @ApiOperation({
    summary: 'Update current user preferences',
    description:
      'Updates notification, language, timezone, theme, and dashboard preference settings for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'User preferences updated successfully.',
    type: UserPreferenceResponseDto,
  })
  async updateMyPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserPreferenceDto,
  ): Promise<UserPreferenceResponseDto> {
    const prefs = await this.userPreferencesService.updateByUserId(userId, dto);
    return plainToInstance(UserPreferenceResponseDto, prefs, {
      excludeExtraneousValues: true,
    });
  }

  @Post('reset')
  @ApiOperation({
    summary: 'Reset preferences to defaults',
    description:
      'Resets the authenticated user preferences to system defaults.',
  })
  @ApiOkResponse({
    description: 'User preferences reset successfully.',
    type: UserPreferenceResponseDto,
  })
  async resetMyPreferences(
    @CurrentUser('id') userId: string,
  ): Promise<UserPreferenceResponseDto> {
    const prefs = await this.userPreferencesService.resetToDefaults(userId);
    return plainToInstance(UserPreferenceResponseDto, prefs, {
      excludeExtraneousValues: true,
    });
  }
}
