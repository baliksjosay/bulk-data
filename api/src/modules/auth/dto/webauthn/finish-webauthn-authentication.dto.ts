import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * DTO for completing a direct WebAuthn authentication ceremony.
 *
 * This is used for passwordless or direct WebAuthn login flows.
 */
export class FinishWebauthnAuthenticationDto {
  @ApiProperty({
    description:
      'Assertion response returned by the browser after navigator.credentials.get(...).',
    example: {
      id: 'credential-id',
      rawId: 'raw-id',
      response: {
        authenticatorData: 'base64url-authenticator-data',
        clientDataJSON: 'base64url-client-data-json',
        signature: 'base64url-signature',
        userHandle: null,
      },
      type: 'public-key',
      clientExtensionResults: {},
    },
  })
  @IsObject()
  assertion: Record<string, unknown>;
}
