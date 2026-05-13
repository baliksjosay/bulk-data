import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class OtpLoginDto {
  @ApiProperty({
    description: 'Phone number, email address, or customer TIN.',
    example: '+256789172796',
  })
  @IsString()
  @MaxLength(255)
  identifier: string;

  @ApiPropertyOptional({
    description: 'Identifier type supplied by the client.',
    enum: ['phone', 'email', 'tin'],
    example: 'phone',
  })
  @IsOptional()
  @IsIn(['phone', 'email', 'tin'])
  identifierKind?: 'phone' | 'email' | 'tin';

  @ApiProperty({
    description: 'Five-digit one-time password.',
    example: '12345',
  })
  @IsString()
  @Matches(/^\d{5}$/)
  otp: string;

  @ApiPropertyOptional({
    description: 'Optional stable identifier for the client device.',
    example: 'device-android-8fd2d42d',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
