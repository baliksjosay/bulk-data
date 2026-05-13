import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

/**
 * DTO used for verifying an already-issued MFA challenge
 * for authenticated users or protected flows.
 */
export class VerifyMfaChallengeDto {
  @ApiProperty({
    description: 'Identifier of the MFA challenge issued by the server.',
    example: '0db250f3-e11b-4a3f-a3d8-896985df7120',
  })
  @IsString()
  challengeId: string;

  @ApiProperty({
    description:
      'Provider-specific response payload. For TOTP, include a `code` property.',
    example: {
      code: '123456',
    },
  })
  @IsObject()
  response: Record<string, unknown>;
}
