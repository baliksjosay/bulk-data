import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { BaseQueryDto } from 'src/common/dto/base-query';

export class UserQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter users by role.',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Filter users by account status.',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter users by authentication provider.',
    enum: AuthProvider,
    example: AuthProvider.LOCAL,
  })
  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;
}
