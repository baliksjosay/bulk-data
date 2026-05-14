import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { UserRole } from '../enums/user-role.enum';

function optionalTrim(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export class CreateStaffUserDto {
  @ApiProperty({
    description: 'Staff email address. This is the only required field.',
    example: 'joseph@example.com',
    format: 'email',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    description:
      'Optional staff phone number. The user or an administrator can add it later.',
    example: '+256789172796',
    maxLength: 32,
  })
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?\d{9,15}$/, {
    message: 'phoneNumber must be a valid phone number',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Optional AD username, for example balikujo. When omitted, it is completed from Active Directory on first successful login.',
    example: 'balikujo',
    maxLength: 255,
  })
  @Transform(({ value }) => optionalTrim(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'AD username may contain only letters, numbers, dots, underscores, and hyphens',
  })
  lanId?: string;

  @ApiPropertyOptional({
    description: 'Staff role to assign. Defaults to support when omitted.',
    enum: [UserRole.ADMIN, UserRole.SUPPORT],
    example: UserRole.SUPPORT,
    default: UserRole.SUPPORT,
  })
  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.SUPPORT])
  role?: UserRole.ADMIN | UserRole.SUPPORT;
}
