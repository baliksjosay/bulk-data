import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({
    description: 'Phone number in international format.',
    example: '+256701234567',
  })
  @IsString()
  phoneNumber: string;
}
