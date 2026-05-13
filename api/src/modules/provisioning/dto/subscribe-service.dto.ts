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
    example: '2026-05-22T13:12:14',
    description: 'PCRF timestamp in yyyy-MM-ddTHH:mm:ss format.',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  startDateTime: string;

  @ApiProperty({
    example: '2026-06-22T13:12:14',
    description: 'PCRF timestamp in yyyy-MM-ddTHH:mm:ss format.',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  endDateTime: string;

  @ApiProperty({ example: '23556778134' })
  @IsString()
  @MaxLength(120)
  transactionId: string;
}
