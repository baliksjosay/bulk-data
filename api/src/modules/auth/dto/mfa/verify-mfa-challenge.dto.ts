import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class VerifyMfaChallengeDto {
  @ApiProperty({
    description:
      'Challenge identifier returned when MFA challenge was created.',
  })
  @IsString()
  challengeId: string;

  @ApiProperty({
    description: 'Provider-specific response payload.',
    example: { code: '123456' },
  })
  @IsObject()
  response: Record<string, unknown>;
}
