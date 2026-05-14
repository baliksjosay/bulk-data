import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import {
  PasswordPolicyResponseDto,
  UpdatePasswordPolicyDto,
} from 'src/modules/users/dto/password-policy.dto';
import { PasswordPolicyService } from 'src/modules/users/services/password-policy.service';

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
    private readonly passwordPolicyService: PasswordPolicyService,
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

  @Get('password-policy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Get customer-local password policy',
    description:
      'Returns the policy applied only to customer local-password activation and password changes. Internal users keep their Active Directory password flow.',
  })
  @ApiOkResponse({
    description: 'Password policy retrieved successfully.',
    type: PasswordPolicyResponseDto,
  })
  async getPasswordPolicy(): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.getEffectivePolicy();
  }

  @Patch('password-policy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update customer-local password policy',
    description:
      'Updates the customer-local password policy without changing internal Active Directory authentication.',
  })
  @ApiOkResponse({
    description: 'Password policy updated successfully.',
    type: PasswordPolicyResponseDto,
  })
  async updatePasswordPolicy(
    @Body() dto: UpdatePasswordPolicyDto,
    @CurrentUser('id') userId: string,
  ): Promise<PasswordPolicyResponseDto> {
    return this.passwordPolicyService.updatePolicy(dto, userId);
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
