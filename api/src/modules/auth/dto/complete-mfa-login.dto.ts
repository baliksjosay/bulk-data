import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * DTO used to complete an MFA-gated login.
 *
 * For OTP-based MFA:
 * - provide `code`
 *
 * For WebAuthn MFA:
 * - provide `assertion`
 */

export class CompleteMfaLoginDto {
  @IsString()
  challengeToken: string;

  @IsString()
  challengeId: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.assertion && !o.recoveryCode)
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  code?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.code && !o.recoveryCode)
  @IsOptional()
  @IsObject()
  assertion?: Record<string, unknown>;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.code && !o.assertion)
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  recoveryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
