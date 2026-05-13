import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateTotpSetupDto {
  @ApiPropertyOptional({
    description: 'Optional label for the authenticator factor.',
    example: 'Primary Authenticator',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
