import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterDeviceTokenDto } from '../dto/register-device-token.dto';
import { MarkReadDto } from '../dto/mark-read.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationsService } from '../services/notifications.service';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { Repository } from 'typeorm';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferenceService: NotificationPreferenceService,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findForUser(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.preferenceService.findForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification' })
  findOne(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.findOneForUser(userId, id);
  }

  @Patch('mark-read')
  @ApiOperation({ summary: 'Mark specific notifications as read' })
  markRead(@CurrentUser('id') userId: string, @Body() dto: MarkReadDto) {
    return this.notificationsService.markRead(userId, dto);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register a push notification device token' })
  async registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const existing = await this.deviceTokenRepo.findOne({
      where: { userId, token: dto.token },
    });
    if (existing) {
      await this.deviceTokenRepo.update(existing.id, {
        isActive: true,
        lastUsedAt: new Date(),
        platform: dto.platform,
        deviceName: dto.deviceName,
      });
      return { ...existing, isActive: true };
    }
    const token = this.deviceTokenRepo.create({ userId, ...dto });
    return this.deviceTokenRepo.save(token);
  }

  @Delete('device-tokens')
  async unregisterDeviceToken(
    @CurrentUser('id') userId: string,
    @Body('token') token: string,
  ) {
    await this.deviceTokenRepo.update(
      { userId, token },
      { isActive: false, lastUsedAt: new Date() },
    );

    return { success: true, message: 'Device token deactivated' };
  }
}
