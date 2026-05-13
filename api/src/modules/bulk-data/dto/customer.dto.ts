import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CustomerStatus, UGANDA_MTN_E164_PATTERN } from './bulk-data.enums';

export class CustomerRegistrationDto {
  @ApiProperty({ example: 'WaveNet Uganda' })
  @IsString()
  @MaxLength(160)
  businessName: string;

  @ApiProperty({ example: '1000172796' })
  @IsString()
  @MaxLength(80)
  registrationNumber: string;

  @ApiProperty({ example: 'accounts@wavenet.ug' })
  @IsEmail()
  businessEmail: string;

  @ApiProperty({ example: '+256772991000' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  businessPhone: string;

  @ApiProperty({ example: 'Sarah Namuli' })
  @IsString()
  @MaxLength(160)
  contactPerson: string;

  @ApiProperty({ example: 'sarah.namuli@wavenet.ug' })
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: '+256772991001' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  contactPhone: string;

  @ApiProperty({ example: 'wavenet.mtn' })
  @IsString()
  @MaxLength(120)
  apnName: string;

  @ApiProperty({ example: 'APN-7781' })
  @IsString()
  @MaxLength(80)
  apnId: string;

  @ApiProperty({ example: '+256772990001' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  primaryMsisdn: string;
}

export class CustomerUpdateDto {
  @ApiPropertyOptional({ example: 'WaveNet Uganda' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessName?: string;

  @ApiPropertyOptional({ example: 'accounts@wavenet.ug' })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ example: '+256772991000' })
  @IsOptional()
  @Matches(UGANDA_MTN_E164_PATTERN)
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'Sarah Namuli' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactPerson?: string;

  @ApiPropertyOptional({ example: 'sarah.namuli@wavenet.ug' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+256772991001' })
  @IsOptional()
  @Matches(UGANDA_MTN_E164_PATTERN)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'wavenet.mtn' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  apnName?: string;

  @ApiPropertyOptional({ example: 'APN-7781' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  apnId?: string;
}

export class CustomerStatusChangeDto {
  @ApiProperty({ enum: [CustomerStatus.ACTIVE, CustomerStatus.DEACTIVATED] })
  @IsEnum(CustomerStatus)
  status: CustomerStatus.ACTIVE | CustomerStatus.DEACTIVATED;

  @ApiProperty({ example: 'Customer requested suspension.' })
  @IsString()
  @MaxLength(240)
  reason: string;

  @ApiPropertyOptional({
    example: 'Signed request uploaded to document store.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  supportingNote?: string;
}

export class PrimaryMsisdnDto {
  @ApiProperty({ example: '+256772990001' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  primaryMsisdn: string;
}

export class SecondaryNumberDto {
  @ApiProperty({ example: '+256772991010' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  msisdn: string;
}

export class SecondaryBulkDto {
  @ApiProperty({ example: ['+256772991010', '+256772991011'], isArray: true })
  @IsArray()
  @Matches(UGANDA_MTN_E164_PATTERN, { each: true })
  msisdns: string[];
}
