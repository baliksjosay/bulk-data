import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({
    description: 'Account activation token.',
  })
  @IsString()
  token: string;
}
