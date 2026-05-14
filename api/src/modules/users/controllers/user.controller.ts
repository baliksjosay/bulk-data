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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { UserService } from '../services/user.service';
import {
  PaginatedUserResponseDto,
  UserResponseDto,
} from '../dto/user-response.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateStaffUserDto } from '../dto/create-staff-user.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UserQueryDto } from '../dto/user-query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangeUserStatusDto } from '../dto/change-user-status.dto';
import { AssignRolesDto } from '../dto/assign-roles.dto';
import { LockUserDto } from '../dto/lock-user.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { toDtos } from 'src/common/utils/toDto';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new local or social-authenticated user account and initializes default user preferences.',
  })
  @ApiCreatedResponse({
    description: 'User created successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or required auth-provider fields are missing.',
  })
  @ApiConflictResponse({
    description: 'Email address or phone number already exists.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.userService.createForActor(currentUser, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post('staff')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create an admin or support user',
    description:
      'Allows an existing administrator to create a staff account with an email address. Optional contact details and role can be supplied, and directory profile details are completed after first successful login.',
  })
  @ApiCreatedResponse({
    description: 'Staff user created successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or unsupported staff role was requested.',
  })
  @ApiConflictResponse({
    description: 'Email address, phone number, or AD username already exists.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async createStaff(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.userService.createStaffForActor(currentUser, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get('staff')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'List admin and support users',
    description:
      'Returns a paginated staff user list for administration and support access management.',
  })
  @ApiOkResponse({
    description: 'Staff users retrieved successfully.',
    type: PaginatedUserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async findStaff(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    const result = await this.userService.findStaffForActor(currentUser, query);

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

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'List users',
    description:
      'Returns a paginated list of users filtered by query parameters such as role, status, provider.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    type: PaginatedUserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    const result = await this.userService.findAllForActor(currentUser, query);

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
    description: 'Returns the authenticated user profile.',
  })
  @ApiOkResponse({
    description: 'Current user profile retrieved successfully.',
    type: UserResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getMe(@CurrentUser('id') userId: string): Promise<UserResponseDto> {
    const user = await this.userService.getMe(userId);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Returns a single user by their unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.requireByIdForActor(currentUser, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Updates selected profile fields for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Current user profile updated successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: Pick<UpdateUserDto, 'firstName' | 'lastName' | 'phoneNumber'>,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateMe(userId, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Update user',
    description:
      'Updates user account details such as name, phone number, roles, and status.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User updated successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({
    description: 'Email address or phone number already exists.',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  async update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.updateForActor(currentUser, id, dto);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Change user status',
    description:
      'Changes the user account status such as ACTIVE, INACTIVE, SUSPENDED, or LOCKED.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User status updated successfully.',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async changeStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.changeStatusForActor(
      currentUser,
      id,
      dto.status,
    );
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id/roles')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Replace user roles',
    description: 'Replaces all roles currently assigned to the user.',
  })
  @ApiOkResponse({
    description: 'User roles updated successfully.',
    type: UserResponseDto,
  })
  async setRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.setRoles(id, dto.roles);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/roles/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Assign roles to user',
    description:
      'Adds one or more roles to the user without removing existing roles.',
  })
  @ApiOkResponse({
    description: 'Roles assigned successfully.',
    type: UserResponseDto,
  })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.assignRoles(id, dto.roles);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/roles/remove')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Remove roles from user',
    description: 'Removes one or more roles from the user.',
  })
  @ApiOkResponse({
    description: 'Roles removed successfully.',
    type: UserResponseDto,
  })
  async removeRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.removeRoles(id, dto.roles);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/lock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Lock user account',
    description: 'Locks the user account for a configurable number of minutes.',
  })
  @ApiOkResponse({
    description: 'User locked successfully.',
    type: UserResponseDto,
  })
  async lockUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userService.lockUserForActor(
      currentUser,
      id,
      dto.minutes,
    );
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/unlock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Unlock user account',
    description: 'Unlocks the user account and resets failed login attempts.',
  })
  @ApiOkResponse({
    description: 'User unlocked successfully.',
    type: UserResponseDto,
  })
  async unlockUser(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.unlockUserForActor(currentUser, id);
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/verify-email')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Mark email as verified',
    description: 'Marks the user email address as verified.',
  })
  @ApiOkResponse({
    description: 'Email marked as verified successfully.',
    type: UserResponseDto,
  })
  async markEmailVerified(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.markEmailVerifiedForActor(
      currentUser,
      id,
    );
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Post(':id/verify-phone')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Mark phone as verified',
    description: 'Marks the user phone number as verified.',
  })
  @ApiOkResponse({
    description: 'Phone marked as verified successfully.',
    type: UserResponseDto,
  })
  async markPhoneVerified(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.userService.markPhoneVerifiedForActor(
      currentUser,
      id,
    );
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user account permanently.',
  })
  @ApiParam({
    name: 'id',
    description: 'User unique identifier.',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User deleted successfully.',
    schema: {
      example: {
        message: 'User deleted successfully',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.userService.delete(id);
    return { message: 'User deleted successfully' };
  }
}
