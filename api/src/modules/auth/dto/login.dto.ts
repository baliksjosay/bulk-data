import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * DTO used for local email/password login.
 */
export class LoginDto {
  @ApiPropertyOptional({
    description: 'Registered email address for password login.',
    example: 'joseph@example.com',
  })
  @ValidateIf((dto: LoginDto) => !dto.username && !dto.phoneNumber)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Username for password login.',
    example: 'joseph',
  })
  @ValidateIf((dto: LoginDto) => !dto.email && !dto.phoneNumber)
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({
    description: 'Registered phone number for password login.',
    example: '+256789172796',
  })
  @ValidateIf((dto: LoginDto) => !dto.email && !dto.username)
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @ApiProperty({
    description: 'User password.',
    example: 'StrongPassword@123',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description:
      'Optional stable identifier for the client device. Used for risk analysis, session recognition, and device-limiting policies.',
    example: 'device-android-8fd2d42d',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
