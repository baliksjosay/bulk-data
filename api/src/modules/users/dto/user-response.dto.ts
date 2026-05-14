import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { Exclude, Expose } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique user identifier.',
    format: 'uuid',
    example: '1c10f0d0-3a3a-4fc7-9b18-4d4e4f8aa001',
  })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Joseph' })
  firstName: string;

  @Expose()
  @ApiProperty({ example: 'Balikuddembe' })
  lastName: string;

  @Expose()
  @ApiProperty({ example: 'joseph@example.com' })
  email: string;

  @Expose()
  @ApiPropertyOptional({ example: '+256701234567' })
  phoneNumber?: string;

  @Expose()
  @ApiPropertyOptional({
    example: 'cus-wavenet',
    description:
      'Customer account identifier linked to this user when the user is a customer.',
  })
  customerId?: string;

  @Expose()
  @ApiProperty({
    enum: AuthProvider,
    example: AuthProvider.LOCAL,
    description: 'Authentication provider linked to the account.',
  })
  authProvider: AuthProvider;

  // expose only if you want frontend to see it
  @Expose()
  @ApiPropertyOptional({
    example: '109876543210987654321',
    description: 'External identity provider user ID.',
  })
  externalId?: string;

  @Expose()
  @ApiProperty({
    enum: UserRole,
    isArray: true,
    example: [UserRole.ADMIN],
  })
  roles: UserRole[];

  @Expose()
  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Expose()
  @ApiProperty({
    example: true,
    description: 'Whether the email address has been verified.',
  })
  emailVerified: boolean;

  @Expose()
  @ApiProperty({
    example: false,
    description: 'Whether the user account is currently locked.',
  })
  isLocked: boolean;

  @Expose()
  @ApiProperty({
    example: '2026-03-17T08:15:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    example: '2026-03-17T08:15:00.000Z',
  })
  updatedAt: Date;

  // NEVER EXPOSE THESE (no decorator needed because of default @Exclude())
  password: string;
  mfaSecret: string;
  failedLoginAttempts: number;
}

export class PaginatedUserResponseDto {
  @ApiProperty({
    description: 'List of users.',
    type: [UserResponseDto],
  })
  data: UserResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata.',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;
}
