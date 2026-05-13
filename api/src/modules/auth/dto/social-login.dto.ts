import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthProvider } from '../enums/auth-provider.enum';

/**
 * DTO used for external identity-provider authentication.
 *
 * The idToken must be a valid Google or Microsoft identity token verified server-side.
 */
export class SocialLoginDto {
  @ApiProperty({
    description: 'Social authentication provider.',
    enum: AuthProvider,
    example: AuthProvider.GOOGLE,
  })
  @IsEnum(AuthProvider)
  provider: AuthProvider.GOOGLE | AuthProvider.MICROSOFT;

  @ApiProperty({
    description:
      'Identity token received from the external provider after successful client-side sign-in.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  @MinLength(10)
  idToken: string;

  @ApiPropertyOptional({
    description:
      'Optional stable identifier for the client device. Used for risk analysis, session recognition, and device-limiting policies.',
    example: 'device-ios-3bc8921f',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
