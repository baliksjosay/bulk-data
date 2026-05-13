import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { MfaMethod } from '../enums/mfa-method.enum';

export class StartMfaLoginChallengeDto {
  @IsString()
  selectionToken: string;

  @IsEnum(MfaMethod)
  mfaMethod: MfaMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
