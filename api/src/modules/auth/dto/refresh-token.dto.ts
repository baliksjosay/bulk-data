import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * DTO used to refresh access and refresh tokens.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token previously issued during successful login.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token.example',
  })
  @IsString()
  @MinLength(10)
  refreshToken: string;
}
