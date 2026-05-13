import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { UserSessionsService } from '../services/user-session.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserSessionResponseDto } from '../dto/user-session-response.dto';


@ApiTags('User Sessions')
@ApiBearerAuth()
@Controller('users/me/sessions')
export class UserSessionsController {
  constructor(private readonly userSessionsService: UserSessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List active sessions for current user',
    description:
      'Returns all active sessions for the authenticated user across devices.',
  })
  @ApiOkResponse({
    description: 'Active sessions retrieved successfully.',
    type: [UserSessionResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async listMySessions(
    @CurrentUser('id') userId: string,
  ): Promise<UserSessionResponseDto[]> {
    const sessions = await this.userSessionsService.listActiveSessions(userId);
    return plainToInstance(UserSessionResponseDto, sessions, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':sessionId')
  @ApiOperation({
    summary: 'Revoke a session',
    description:
      'Revokes a specific active session belonging to the authenticated user.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session unique identifier.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Session revoked successfully.',
    schema: {
      example: {
        message: 'Session revoked successfully',
      },
    },
  })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<{ message: string }> {
    await this.userSessionsService.revokeSessionForUser(userId, sessionId);
    return { message: 'Session revoked successfully' };
  }

  @Delete()
  @ApiOperation({
    summary: 'Revoke all sessions',
    description:
      'Revokes all active sessions for the authenticated user across all devices.',
  })
  @ApiOkResponse({
    description: 'All sessions revoked successfully.',
    schema: {
      example: {
        message: 'All sessions revoked successfully',
      },
    },
  })
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    await this.userSessionsService.revokeAllUserSessions(userId);
    return { message: 'All sessions revoked successfully' };
  }
}
