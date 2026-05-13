import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '../../users/enums/user-role.enum';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { InjectRepository } from '@nestjs/typeorm';
import { SecurityAuditLog } from '../entities/security-audit-log.entity';
import { Repository } from 'typeorm';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserService } from 'src/modules/users/services/user.service';
import { Roles } from 'src/common/decorators/roles.decorator';

/**
 * Exposes security and audit operations for privileged users.
 */
@ApiTags('Authentication - Security')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('auth/security')
export class SecurityController {
  constructor(
    private readonly usersService: UserService,
    @InjectRepository(SecurityAuditLog)
    private readonly securityAuditLogRepo: Repository<SecurityAuditLog>,
  ) {}

  @Get('audit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'List recent security audit events',
  })
  @ApiOkResponse({
    description: 'Security audit events retrieved successfully.',
  })
  async listAuditLogs() {
    return this.securityAuditLogRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  @Post('unlock/:userId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Unlock a locked user account',
  })
  @ApiOkResponse({
    description: 'User unlocked successfully.',
    type: UserResponseDto,
  })
  async unlockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.unlockUser(userId);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
