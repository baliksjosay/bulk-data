import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyTotpSetupDto {
  @ApiProperty({
    description: 'TOTP setup challenge identifier.',
  })
  @IsString()
  challengeId: string;

  @ApiProperty({
    description: 'One-time TOTP code from authenticator app.',
    example: '123456',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  code: string;
}
