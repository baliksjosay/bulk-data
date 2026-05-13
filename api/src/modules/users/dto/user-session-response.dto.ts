import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserSessionResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique session identifier.',
    format: 'uuid',
    example: '7e2d7d73-6b53-4e8e-9f64-9fae7f6f4a33',
  })
  id: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Device identifier.',
    example: 'device-abc-123',
  })
  deviceId?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Device type.',
    example: 'mobile',
  })
  deviceType?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Browser name.',
    example: 'Chrome',
  })
  browser?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Operating system.',
    example: 'Android',
  })
  os?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'IP address used for the session.',
    example: '102.89.33.10',
  })
  ipAddress?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'User agent string.',
    example: 'Mozilla/5.0 ...',
  })
  userAgent?: string;

  @Expose()
  @ApiProperty({
    description: 'Whether the session is currently active.',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    description: 'Session expiry time.',
    example: '2026-03-19T12:00:00.000Z',
  })
  expiresAt: Date;

  @Expose()
  @ApiPropertyOptional({
    description: 'Last activity timestamp.',
    example: '2026-03-17T11:00:00.000Z',
  })
  lastActivityAt?: Date;

  @Expose()
  @ApiProperty({
    description: 'Session creation timestamp.',
    example: '2026-03-17T08:15:00.000Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Session update timestamp.',
    example: '2026-03-17T08:15:00.000Z',
  })
  updatedAt: Date;
}
