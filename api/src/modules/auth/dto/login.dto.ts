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
    description:
      'Single password-login identifier. Customers may use TIN, phone number, or email. Staff users must use their AD username / lanId.',
    example: 'balikujo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  identifier?: string;

  @ApiPropertyOptional({
    description:
      'Registered customer email address for password login. Staff users must use username / lanId instead.',
    example: 'joseph@example.com',
  })
  @ValidateIf(
    (dto: LoginDto) => !dto.identifier && !dto.username && !dto.phoneNumber,
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'AD username / lanId for staff password login.',
    example: 'balikujo',
  })
  @ValidateIf(
    (dto: LoginDto) => !dto.identifier && !dto.email && !dto.phoneNumber,
  )
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({
    description: 'Registered phone number for password login.',
    example: '+256789172796',
  })
  @ValidateIf((dto: LoginDto) => !dto.identifier && !dto.email && !dto.username)
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
