import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  ServiceRequestStatus,
  UGANDA_MTN_E164_PATTERN,
} from './bulk-data.enums';
import { CustomerRegistrationDto } from './customer.dto';

export class ServiceRequestDto {
  @ApiProperty({ example: 'WaveNet Uganda' })
  @IsString()
  @MaxLength(160)
  businessName: string;

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

  @ApiPropertyOptional({ example: 'bundle-1tb' })
  @IsOptional()
  @IsString()
  preferredPackageId?: string;

  @ApiPropertyOptional({ example: 'We need data pooling for branch routers.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class ServiceRequestUpdateDto {
  @ApiProperty({
    enum: [ServiceRequestStatus.NEW, ServiceRequestStatus.CONTACTED],
  })
  @IsEnum(ServiceRequestStatus)
  status: ServiceRequestStatus.NEW | ServiceRequestStatus.CONTACTED;

  @ApiPropertyOptional({ example: 'Customer contacted by support.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ServiceRequestConversionDto extends CustomerRegistrationDto {}
