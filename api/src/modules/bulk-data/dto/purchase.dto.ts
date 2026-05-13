import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentMethod,
  PaymentSessionStatus,
  PrnPaymentProvider,
  UGANDA_MTN_E164_PATTERN,
} from './bulk-data.enums';

export class PurchaseDto {
  @ApiProperty({ example: 'cus-wavenet' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: '+256772990001' })
  @Matches(UGANDA_MTN_E164_PATTERN)
  primaryMsisdn: string;

  @ApiProperty({ example: 'bundle-1tb' })
  @IsString()
  bundleId: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  provisioningCount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PRN })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: '+256772990001' })
  @IsOptional()
  @Matches(UGANDA_MTN_E164_PATTERN)
  payingMsisdn?: string;

  @ApiPropertyOptional({
    enum: PrnPaymentProvider,
    example: PrnPaymentProvider.BANK,
  })
  @IsOptional()
  @IsEnum(PrnPaymentProvider)
  prnProvider?: PrnPaymentProvider;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    example: 'https://portal.example.com/checkout/return',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectUrl?: string;

  @ApiPropertyOptional({
    example: 'Customer requested weekend bundle',
    description: 'Additional provider note for PRN generation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  additionalInfo?: string;
}

export class PurchaseRetryDto {
  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.PRN })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: '+256772990001' })
  @IsOptional()
  @Matches(UGANDA_MTN_E164_PATTERN)
  payingMsisdn?: string;

  @ApiPropertyOptional({
    enum: PrnPaymentProvider,
    example: PrnPaymentProvider.BANK,
  })
  @IsOptional()
  @IsEnum(PrnPaymentProvider)
  prnProvider?: PrnPaymentProvider;

  @ApiPropertyOptional({
    example: 'https://portal.example.com/checkout/return',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectUrl?: string;

  @ApiPropertyOptional({
    example: 'Customer requested weekend bundle',
    description: 'Additional provider note for PRN generation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  additionalInfo?: string;
}

export class PurchaseConfirmationDto {
  @ApiProperty({ example: 'pay-20260422-001' })
  @IsString()
  sessionId: string;

  @ApiProperty({
    enum: [PaymentSessionStatus.CONFIRMED, PaymentSessionStatus.FAILED],
  })
  @IsEnum(PaymentSessionStatus)
  status: PaymentSessionStatus.CONFIRMED | PaymentSessionStatus.FAILED;
}

export class PaymentProviderCallbackDto {
  @ApiPropertyOptional({ example: 'pay-20260422-001' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ example: 'txn-20260422-001' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    example: '6bc9766c-4f33-4493-a22c-1cc52c7ac365',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  internalTransactionId?: string;

  @ApiPropertyOptional({ example: 'TXN-123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientTransactionId?: string;

  @ApiPropertyOptional({ example: 'A2086517260219' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentReference?: string;

  @ApiPropertyOptional({
    enum: [
      ...Object.values(PaymentSessionStatus),
      'paid',
      'approved',
      'deducted',
    ],
    example: PaymentSessionStatus.CONFIRMED,
  })
  @IsIn([
    ...Object.values(PaymentSessionStatus),
    'paid',
    'approved',
    'deducted',
  ])
  @IsOptional()
  status?: PaymentSessionStatus | 'paid' | 'approved' | 'deducted';

  @ApiPropertyOptional({ example: 'GW-20260422-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerReference?: string;

  @ApiPropertyOptional({ example: 'RCT-20260422-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiptNumber?: string;

  @ApiPropertyOptional({ example: 'Issuer declined transaction' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  failureReason?: string;
}
