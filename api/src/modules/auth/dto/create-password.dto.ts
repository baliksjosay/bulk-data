import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePasswordDto {
  @ApiProperty({
    description: 'Account activation or password setup token.',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password to assign to the account.',
    example: 'StrongPassword@123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
