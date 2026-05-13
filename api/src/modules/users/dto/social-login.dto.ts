import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthProvider } from '../../users/enums/auth-provider.enum';

export class SocialLoginDto {
  @ApiProperty({
    description: 'OAuth provider used for authentication.',
    enum: AuthProvider,
    example: AuthProvider.GOOGLE,
  })
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @ApiProperty({
    description:
      'Identity token returned by Google or Microsoft after successful sign-in.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({
    description: 'Optional access token from provider if needed.',
    example: 'EwBoA8l6BAAU...',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({
    description: 'Optional client application identifier.',
    example: 'web-dashboard',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
}
