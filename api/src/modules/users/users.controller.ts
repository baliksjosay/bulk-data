import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserService } from './services/user.service';
import { UserRole } from './enums/user-role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  PaginatedUserResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from './enums/user-status.enum';
import { toDtos } from 'src/common/utils/toDto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Create user',
    description: 'Creates a new user.',
  })
  @ApiCreatedResponse({
    description: 'User created successfully.',
    type: UserResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'You are not allowed to create a user for the requested.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized.',
  })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.createForActor(actor, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'List users',
    description: 'Returns a paginated list of users.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    type: PaginatedUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized.',
  })
  async findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    const result = await this.userService.findAllForActor(actor, query);

    return {
      data: toDtos(UserResponseDto, result.data),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
      },
    };
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the currently authenticated user profile.',
  })
  @ApiOkResponse({
    description: 'Current user profile retrieved successfully.',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized.',
  })
  async getMe(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    const user = await this.userService.getMe(userId);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates the authenticated user profile. Only self-service profile fields are supported here.',
  })
  @ApiOkResponse({
    description: 'Current user profile updated successfully.',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized.',
  })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: Pick<UpdateUserDto, 'firstName' | 'lastName' | 'phoneNumber'>,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateMe(userId, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by id',
    description: 'Returns a user by identifier.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'User identifier.',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  @ApiForbiddenResponse({
    description: 'You are not allowed to access this user.',
  })
  async findOne(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.requireByIdForActor(actor, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Update user',
    description: 'Updates a user by id.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'User identifier.',
  })
  @ApiOkResponse({
    description: 'User updated successfully.',
    type: UserResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'You are not allowed to update this user.',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateForActor(actor, id, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/status/:status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Change user status',
    description:
      'Changes a user status. Setting status to LOCKED delegates to the lock flow.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'User identifier.',
  })
  @ApiParam({
    name: 'status',
    enum: UserStatus,
    description: 'Target user status.',
  })
  @ApiOkResponse({
    description: 'User status changed successfully.',
    type: UserResponseDto,
  })
  async changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
  ): Promise<UserResponseDto> {
    const user = await this.userService.changeStatusForActor(actor, id, status);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Activate user' })
  @ApiOkResponse({
    description: 'User activated successfully.',
    type: UserResponseDto,
  })
  async activate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    await this.userService.requireByIdForActor(actor, id);
    const user = await this.userService.activate(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiOkResponse({
    description: 'User deactivated successfully.',
    type: UserResponseDto,
  })
  async deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    await this.userService.requireByIdForActor(actor, id);
    const user = await this.userService.deactivate(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Suspend user' })
  @ApiOkResponse({
    description: 'User suspended successfully.',
    type: UserResponseDto,
  })
  async suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    await this.userService.requireByIdForActor(actor, id);
    const user = await this.userService.suspend(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Reactivate user' })
  @ApiOkResponse({
    description: 'User reactivated successfully.',
    type: UserResponseDto,
  })
  async reactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    await this.userService.requireByIdForActor(actor, id);
    const user = await this.userService.reactivate(id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/lock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Lock user',
    description: 'Locks a user account for the default lock duration.',
  })
  @ApiOkResponse({
    description: 'User locked successfully.',
    type: UserResponseDto,
  })
  async lock(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.lockUserForActor(actor, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/unlock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Unlock user',
    description: 'Unlocks a previously locked user account.',
  })
  @ApiOkResponse({
    description: 'User unlocked successfully.',
    type: UserResponseDto,
  })
  async unlock(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.unlockUserForActor(actor, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/email-verified')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Mark email verified',
    description: 'Marks the user email as verified.',
  })
  @ApiOkResponse({
    description: 'User email marked as verified successfully.',
    type: UserResponseDto,
  })
  async markEmailVerified(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.markEmailVerifiedForActor(actor, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/phone-verified')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Mark phone verified',
    description: 'Marks the user phone number as verified.',
  })
  @ApiOkResponse({
    description: 'User phone marked as verified successfully.',
    type: UserResponseDto,
  })
  async markPhoneVerified(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.markPhoneVerifiedForActor(actor, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user account.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'User identifier.',
  })
  @ApiOkResponse({
    description: 'User deleted successfully.',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.userService.delete(id);
  }
}
