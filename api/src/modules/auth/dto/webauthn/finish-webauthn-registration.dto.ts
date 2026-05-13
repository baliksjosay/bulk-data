import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * DTO for completing WebAuthn registration.
 *
 * The payload should be the attestation response returned by the browser.
 */
export class FinishWebauthnRegistrationDto {
  @ApiProperty({
    description:
      'Attestation response returned by the browser after WebAuthn registration.',
    example: {
      id: 'credential-id',
      rawId: 'raw-id',
      response: {
        attestationObject: 'base64url-attestation-object',
        clientDataJSON: 'base64url-client-data-json',
      },
      type: 'public-key',
      clientExtensionResults: {},
    },
  })
  @IsObject()
  attestation: Record<string, unknown>;
}
