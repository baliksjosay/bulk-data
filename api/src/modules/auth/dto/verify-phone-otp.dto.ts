import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty({
    description: 'One-time verification code.',
    example: '123456',
  })
  @IsString()
  otp: string;
}
