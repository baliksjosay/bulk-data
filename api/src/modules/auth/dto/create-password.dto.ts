import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreatePasswordDto {
  @ApiProperty({
    description: 'Account activation or password setup token.',
    required: false,
  })
  @ValidateIf((dto: CreatePasswordDto) => !dto.passwordSetupToken)
  @IsString()
  token?: string;

  @ApiProperty({
    description: 'Account activation password setup token.',
    required: false,
  })
  @ValidateIf((dto: CreatePasswordDto) => !dto.token)
  @IsString()
  passwordSetupToken?: string;

  @ApiProperty({
    description: 'New password to assign to the account.',
    example: 'StrongPassword@123',
  })
  @IsString()
  @MinLength(14)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: 'Optional confirmation supplied by activation clients.',
    required: false,
  })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
