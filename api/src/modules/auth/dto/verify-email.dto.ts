import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token.',
  })
  @IsString()
  token: string;
}

/**
 * DTO for sending an email verification token.
 *
 * If no userId is supplied, the authenticated user is used.
 */
export class SendEmailVerificationDto {
  @ApiPropertyOptional({
    description:
      'Optional target user identifier for admin-triggered verification.',
    format: 'uuid',
    example: '7e2d7d73-6b53-4e8e-9f64-9fae7f6f4a33',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
