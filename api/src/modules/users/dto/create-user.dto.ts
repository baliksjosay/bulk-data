import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'User first name.',
    example: 'Joseph',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'User last name.',
    example: 'Balikuddembe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Unique email address for the user account.',
    example: 'joseph@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format.',
    example: '+256701234567',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Authentication provider used by this account.',
    enum: AuthProvider,
    example: AuthProvider.LOCAL,
  })
  @IsEnum(AuthProvider)
  authProvider: AuthProvider;

  @ApiPropertyOptional({
    description:
      'Password for locally authenticated users. Required when authProvider is LOCAL.',
    example: 'StrongPassword@123',
    minLength: 8,
    maxLength: 128,
  })
  @ValidateIf((o) => o.authProvider === AuthProvider.LOCAL)
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    description:
      'External provider identifier. Required for Google and Microsoft authenticated users.',
    example: '109876543210987654321',
    maxLength: 255,
  })
  @ValidateIf((o) => o.authProvider !== AuthProvider.LOCAL)
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @ApiProperty({
    description: 'Roles assigned to the user.',
    enum: UserRole,
    isArray: true,
    example: [UserRole.ADMIN],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @ApiPropertyOptional({
    description: 'Initial status of the user account.',
    enum: UserStatus,
    example: UserStatus.PENDING,
    default: UserStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
