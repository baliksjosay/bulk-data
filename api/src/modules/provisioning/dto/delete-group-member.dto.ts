import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import {
  normalizeProvisioningMsisdn,
  PROVISIONING_UGANDA_MSISDN_PATTERN,
} from '../utils/provisioning-msisdn.util';

export class DeleteGroupMemberDto {
  @ApiProperty({
    description:
      'Secondary MSISDN to remove from the group subscription. Accepts 256XXXXXXXXX or +256XXXXXXXXX and is normalized before dispatch.',
    example: '256779999707',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeProvisioningMsisdn(value) : value,
  )
  @IsString()
  @Matches(PROVISIONING_UGANDA_MSISDN_PATTERN, {
    message:
      'secondaryMsisdn must be a Uganda MTN MSISDN in 256XXXXXXXXX format',
  })
  secondaryMsisdn: string;
}
