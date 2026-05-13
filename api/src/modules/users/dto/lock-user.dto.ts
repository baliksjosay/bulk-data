import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LockUserDto {
  @ApiPropertyOptional({
    description: 'Number of minutes to lock the account.',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 1440,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes?: number = 30;

  @ApiPropertyOptional({
    description: 'Reason for locking the user account.',
    example: 'Too many failed login attempts.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
