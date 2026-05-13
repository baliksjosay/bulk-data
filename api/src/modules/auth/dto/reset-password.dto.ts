import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token.',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password to assign.',
    example: 'NewStrongPassword@123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
