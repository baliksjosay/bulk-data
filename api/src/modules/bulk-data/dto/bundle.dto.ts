import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BundleStatus } from './bulk-data.enums';

export class BundlePackageDto {
  @ApiProperty({ example: 'BDS-1T-30D' })
  @IsString()
  @MaxLength(80)
  serviceCode: string;

  @ApiProperty({ example: 'Wholesale 1 TB' })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 1, minimum: 0.01, maximum: 4 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(4)
  volumeTb: number;

  @ApiProperty({ example: 2300000, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceUgx: number;

  @ApiProperty({
    example: 30,
    description: 'Wholesale bulk data bundles are fixed at 30 days.',
  })
  @Type(() => Number)
  @IsInt()
  @Equals(30)
  validityDays: number;

  @ApiProperty({ enum: BundleStatus, example: BundleStatus.ACTIVE })
  @IsEnum(BundleStatus)
  status: BundleStatus;

  @ApiProperty({ example: true })
  @IsBoolean()
  visible: boolean;
}

export class BundlePackageUpdateDto extends PartialType(BundlePackageDto) {}
