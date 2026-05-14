import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { PROVISIONING_UGANDA_MSISDN_PATTERN } from '../utils/provisioning-msisdn.util';

export class SubscribeServiceDto {
  @ApiProperty({ example: '256779999707' })
  @IsString()
  @Matches(PROVISIONING_UGANDA_MSISDN_PATTERN)
  msisdn: string;

  @ApiProperty({ example: 'FWA_20MBPS' })
  @IsString()
  @MaxLength(120)
  serviceCode: string;

  @ApiProperty({
    example: '20260522131214',
    description: 'PCRF timestamp in yyyyMMddHHmmss format.',
  })
  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'startDateTime must be in yyyyMMddHHmmss format',
  })
  startDateTime: string;

  @ApiProperty({
    example: '20260622131214',
    description: 'PCRF timestamp in yyyyMMddHHmmss format.',
  })
  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'endDateTime must be in yyyyMMddHHmmss format',
  })
  endDateTime: string;

  @ApiProperty({ example: '23556778134' })
  @IsString()
  @MaxLength(120)
  transactionId: string;
}
