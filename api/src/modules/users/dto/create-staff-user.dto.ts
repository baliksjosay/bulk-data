import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Matches, MaxLength } from 'class-validator';

import { UserRole } from '../enums/user-role.enum';

export class CreateStaffUserDto {
  @ApiProperty({
    description:
      'Staff phone number used for account contact and verification challenges.',
    example: '+256789172796',
    maxLength: 32,
  })
  @IsString()
  @MaxLength(32)
  @Matches(/^\+?\d{9,15}$/, {
    message: 'phoneNumber must be a valid phone number',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Staff email address.',
    example: 'joseph@example.com',
    format: 'email',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Corporate login identifier for staff authentication.',
    example: 'jbalikuddembe',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'lanId may contain only letters, numbers, dots, underscores, and hyphens',
  })
  lanId: string;

  @ApiProperty({
    description:
      'Staff role to assign. Only admin and support users can be created here.',
    enum: [UserRole.ADMIN, UserRole.SUPPORT],
    example: UserRole.SUPPORT,
  })
  @IsIn([UserRole.ADMIN, UserRole.SUPPORT])
  role: UserRole.ADMIN | UserRole.SUPPORT;
}
