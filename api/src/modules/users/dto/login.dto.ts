import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address.',
    example: 'joseph@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password for local authentication.',
    example: 'StrongPassword@123',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
