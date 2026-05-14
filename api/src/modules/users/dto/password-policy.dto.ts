import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PasswordPolicyResponseDto {
  @ApiProperty({ example: 'CUSTOMER_LOCAL' })
  appliesTo: 'CUSTOMER_LOCAL';

  @ApiProperty({ example: 90 })
  maxPasswordAgeWarmBodiedDays: number;

  @ApiProperty({ example: 365 })
  maxPasswordAgeServiceAccountDays: number;

  @ApiProperty({ example: 1 })
  minPasswordAgeDays: number;

  @ApiProperty({ example: 24 })
  passwordHistoryCount: number;

  @ApiProperty({ example: 14 })
  minPasswordLength: number;

  @ApiProperty({ example: true })
  complexityEnabled: boolean;

  @ApiProperty({ example: true })
  hashingEnabled: boolean;

  @ApiProperty({ example: 3 })
  accountLockoutThreshold: number;

  @ApiProperty({ example: 1 })
  maxSessionsPerUser: number;

  @ApiProperty({ example: true })
  forcePasswordChangeAtFirstLogin: boolean;

  @ApiProperty({ example: 90 })
  inactiveAccountLockDays: number;

  @ApiProperty({ example: true })
  ssoAllowed: boolean;

  @ApiProperty({ example: true })
  mfaSupported: boolean;

  @ApiProperty({ example: true })
  leastPrivilegeEnabled: boolean;

  @ApiProperty({ example: true })
  rbacEnabled: boolean;

  @ApiProperty({ example: 'BeyondTrust' })
  pamProvider: string;

  @ApiPropertyOptional({ example: '2026-05-14T07:00:00.000Z' })
  updatedAt?: string;

  @ApiPropertyOptional({ example: 'dfb1d1c9-a822-4047-9b54-61b9f9d2f3cf' })
  updatedBy?: string;
}

export class UpdatePasswordPolicyDto {
  @ApiPropertyOptional({ example: 90, minimum: 1, maximum: 730 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(730)
  maxPasswordAgeWarmBodiedDays?: number;

  @ApiPropertyOptional({ example: 365, minimum: 1, maximum: 1095 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1095)
  maxPasswordAgeServiceAccountDays?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  minPasswordAgeDays?: number;

  @ApiPropertyOptional({ example: 24, minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  passwordHistoryCount?: number;

  @ApiPropertyOptional({ example: 14, minimum: 8, maximum: 128 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  minPasswordLength?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  complexityEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hashingEnabled?: boolean;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  accountLockoutThreshold?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSessionsPerUser?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  forcePasswordChangeAtFirstLogin?: boolean;

  @ApiPropertyOptional({ example: 90, minimum: 1, maximum: 730 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(730)
  inactiveAccountLockDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ssoAllowed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  mfaSupported?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  leastPrivilegeEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rbacEnabled?: boolean;

  @ApiPropertyOptional({ example: 'BeyondTrust' })
  @IsOptional()
  @IsString()
  pamProvider?: string;
}
