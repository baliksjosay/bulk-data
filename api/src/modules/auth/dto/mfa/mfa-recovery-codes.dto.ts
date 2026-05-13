import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyRecoveryCodeDto {
  @ApiProperty({
    example: 'ABCD-1234',
  })
  @IsString()
  code: string;
}

export class MfaRecoveryCodesResponseDto {
  @ApiProperty({
    description: 'Identifier of the generated recovery-code batch.',
    example: '3abf44fd-e4c7-4c7d-8b3f-68563d45f0cc',
  })
  batchId: string;

  @ApiProperty({
    description: 'Recovery codes shown once to the user.',
    type: [String],
    example: ['ABCD-EFGH-72KQ', 'T9PL-4MZX-QW8N'],
  })
  codes: string[];
}

export class AcknowledgeRecoveryCodesDto {
  @ApiProperty({
    description: 'Recovery code batch identifier.',
    example: '3abf44fd-e4c7-4c7d-8b3f-68563d45f0cc',
  })
  @IsUUID()
  batchId: string;
}


export class GenerateRecoveryCodesDto {
  @ApiPropertyOptional({
    description: 'Current password for re-authentication.',
    example: 'StrongPassword@123',
  })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({
    description: 'Recent re-auth token issued by the auth module.',
  })
  @IsOptional()
  @IsString()
  reauthToken?: string;
}

export class MfaRecoveryStatusDto {
  @ApiProperty()
  hasActiveBatch: boolean;

  @ApiProperty()
  totalCodes: number;

  @ApiProperty()
  usedCodes: number;

  @ApiProperty()
  remainingCodes: number;

  @ApiProperty()
  shouldRegenerate: boolean;

  @ApiProperty()
  warning: boolean;

  @ApiPropertyOptional()
  warningMessage?: string | null;

  @ApiProperty()
  policyViolation: boolean;
}
