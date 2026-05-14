import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  normalizeProvisioningMsisdn,
  normalizeTrimmedString,
  PROVISIONING_UGANDA_MSISDN_PATTERN,
} from '../utils/provisioning-msisdn.util';

export class AddSubscriberDto {
  @ApiProperty({
    description: 'Primary MSISDN to add as a subscriber through provisioning.',
    example: '256779999707',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeProvisioningMsisdn(value) : value,
  )
  @IsString()
  @Matches(PROVISIONING_UGANDA_MSISDN_PATTERN, {
    message: 'msisdn must be a Uganda MTN MSISDN in 256XXXXXXXXX format',
  })
  msisdn: string;

  @ApiProperty({
    description:
      'Business transaction identifier associated with customer registration or provisioning.',
    example: '78954566743',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeTrimmedString(value) : value,
  )
  @IsString()
  @MaxLength(120)
  transactionId: string;
}
