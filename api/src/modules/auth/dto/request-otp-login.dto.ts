import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestOtpLoginDto {
  @ApiProperty({
    description: 'Phone number, email address, or customer TIN.',
    example: '+256789172796',
  })
  @IsString()
  @MaxLength(255)
  identifier: string;

  @ApiPropertyOptional({
    description: 'Identifier type supplied by the client.',
    enum: ['phone', 'email', 'tin'],
    example: 'phone',
  })
  @IsOptional()
  @IsIn(['phone', 'email', 'tin'])
  identifierKind?: 'phone' | 'email' | 'tin';

  @ApiPropertyOptional({
    description:
      'Preferred delivery channel. If unavailable, the system falls back to an available verified contact method.',
    enum: ['sms', 'email'],
    example: 'sms',
  })
  @IsOptional()
  @IsIn(['sms', 'email'])
  deliveryChannel?: 'sms' | 'email';
}

export class RequestOtpLoginResponseDto {
  @ApiProperty({
    description:
      'Whether the request was accepted. This is generic to avoid account enumeration.',
    example: true,
  })
  accepted: boolean;

  @ApiPropertyOptional({
    description:
      'Challenge identifier to submit together with the OTP. Omitted when no matching customer account exists.',
    example: '2f0dce94-9e01-4cb4-a5ab-840d3447d6f0',
  })
  challengeId?: string;

  @ApiPropertyOptional({
    description: 'Masked delivery destination shown to the user.',
    example: '********2796',
  })
  maskedDestination?: string;

  @ApiPropertyOptional({
    description: 'Channel used for OTP delivery.',
    enum: ['sms', 'email'],
    example: 'sms',
  })
  deliveryChannel?: 'sms' | 'email';

  @ApiPropertyOptional({
    description: 'OTP expiry timestamp.',
    example: '2026-05-14T10:00:00.000Z',
  })
  expiresAt?: string;

  @ApiProperty({
    description: 'Minimum seconds before requesting another OTP.',
    example: 60,
  })
  retryAfterSeconds: number;
}
