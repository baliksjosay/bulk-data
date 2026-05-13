import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/enums/user-role.enum';
export const ROLES_KEY = 'roles';

/**
 * Roles decorator
 * Specifies required roles for accessing a route
 *
 * @param roles - Array of allowed roles
 *
 * @example
 * @Roles(UserRole.ADMIN, UserRole.MODERATOR)
 * @Get('admin/users')
 * getUsers() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
