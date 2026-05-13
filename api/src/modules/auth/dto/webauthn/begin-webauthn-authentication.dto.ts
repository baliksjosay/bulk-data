import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO for beginning a WebAuthn authentication ceremony.
 *
 * Either userId or email may be supplied depending on the entry flow.
 * If neither is supplied, discoverable credentials can still be used.
 */
export class BeginWebauthnAuthenticationDto {
  @ApiPropertyOptional({
    description: 'User identifier for the authentication ceremony.',
    format: 'uuid',
    example: '7f4cf4e2-31ef-4a1c-a129-0d678b8d3201',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'User email for the authentication ceremony.',
    example: 'joseph@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
