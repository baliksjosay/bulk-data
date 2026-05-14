import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';
import {
  normalizeProvisioningMsisdn,
  normalizeTrimmedString,
  PROVISIONING_UGANDA_MSISDN_PATTERN,
} from '../utils/provisioning-msisdn.util';

export class UpdateSubscriptionDto {
  @ApiProperty({
    description:
      'Primary MSISDN whose subscription should be topped up or updated.',
    example: '256772123456',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeProvisioningMsisdn(value) : value,
  )
  @IsString()
  @Matches(PROVISIONING_UGANDA_MSISDN_PATTERN, {
    message: 'primaryMsisdn must be a Uganda MTN MSISDN in 256XXXXXXXXX format',
  })
  primaryMsisdn: string;

  @ApiProperty({
    description:
      'Provisioning service code to update. This should match the configured bundle/service identifier.',
    example: 'DATA_BUNDLE_CODE',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTrimmedString(value) : value,
  )
  @IsString()
  @MaxLength(120)
  serviceCode: string;

  @ApiProperty({
    description:
      'Business transaction identifier associated with the provisioning workflow.',
    example: '567123456',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTrimmedString(value) : value,
  )
  @IsString()
  @MaxLength(120)
  transactionId: string;

  @ApiProperty({
    description:
      'Top-up volume in kilobytes (KB). Purchase workflows must convert bundle volume to KB before calling this endpoint.',
    example: 1024,
  })
  @IsInt()
  @Min(1)
  topupValue: number;

  @ApiProperty({
    description:
      'Number of additional subscription update attempts that the provisioning system should apply after the initial provisioning.',
    example: 4,
  })
  @IsInt()
  @Min(0)
  updateAttemptCount: number;
}
