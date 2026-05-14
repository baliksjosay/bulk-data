import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum AccountActivationDeliveryChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

export class AccountActivationOtpRequestDto {
  @ApiProperty({
    description: 'Activation token from the customer activation link.',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description:
      'Email address or phone number already captured by an administrator.',
    example: 'customer@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    enum: AccountActivationDeliveryChannel,
    example: AccountActivationDeliveryChannel.EMAIL,
  })
  @IsEnum(AccountActivationDeliveryChannel)
  deliveryChannel: AccountActivationDeliveryChannel;
}

export class AccountActivationOtpResponseDto {
  @ApiProperty({ example: '9e2e4a4f-fad3-4d4b-9030-b4f9f717b1ec' })
  activationId: string;

  @ApiProperty({ example: 'jo***@example.com' })
  maskedDestination: string;

  @ApiProperty({ example: 'jo***@example.com' })
  maskedEmail: string;

  @ApiProperty({
    enum: AccountActivationDeliveryChannel,
    example: AccountActivationDeliveryChannel.EMAIL,
  })
  deliveryChannel: AccountActivationDeliveryChannel;

  @ApiProperty({ example: '2026-05-14T08:45:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: 60 })
  retryAfterSeconds: number;
}

export class AccountActivationOtpVerifyDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: '9e2e4a4f-fad3-4d4b-9030-b4f9f717b1ec' })
  @IsString()
  activationId: string;

  @ApiProperty({ example: '12345' })
  @Matches(/^\d{5}$/)
  otp: string;
}

export class AccountActivationOtpVerifyResponseDto {
  @ApiProperty()
  passwordSetupToken: string;

  @ApiProperty({ example: '2026-05-14T09:40:00.000Z' })
  expiresAt: string;
}

export class AccountActivationPasswordDto {
  @ApiProperty()
  @IsString()
  passwordSetupToken: string;

  @ApiProperty({
    description: 'New customer-local password.',
    example: 'CustomerPortal@2026',
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Password confirmation supplied by the activation UI.',
    example: 'CustomerPortal@2026',
  })
  @IsString()
  confirmPassword: string;

  @ApiProperty({
    description: 'Optional device identifier supplied by the client.',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class AccountActivationIdentifierDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;
}
