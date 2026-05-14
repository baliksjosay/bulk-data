import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Standard authentication response.
 *
 * This DTO is used both for:
 * - direct successful login, where access and refresh tokens are issued immediately
 * - MFA-gated login, where a challenge token is returned first and final tokens
 *   are issued only after MFA verification
 */
export class AuthResponseDto {
  @ApiPropertyOptional({
    description:
      'JWT access token issued after successful authentication. This field is omitted when MFA verification is still pending.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token.example',
  })
  accessToken?: string;

  @ApiPropertyOptional({
    description:
      'JWT refresh token issued after successful authentication. This field is omitted when MFA verification is still pending.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token.example',
  })
  refreshToken?: string;

  @ApiPropertyOptional({
    description:
      'Identifier of the authenticated session. This field is present only after final authentication completes.',
    format: 'uuid',
    example: '7f4cf4e2-31ef-4a1c-a129-0d678b8d3201',
  })
  sessionId?: string;

  @ApiProperty({
    description:
      'Indicates whether a second authentication step is required before final session tokens are issued.',
    example: false,
  })
  mfaRequired: boolean;

  @ApiPropertyOptional({
    description:
      'Temporary MFA challenge token used to complete MFA verification. Present only when MFA is required.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mfa-challenge-token.example',
  })
  challengeToken?: string;

  @ApiPropertyOptional({
    description:
      'Temporary token used to start the selected MFA method. Present when MFA is required but no factor challenge has been created yet.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mfa-selection-token.example',
  })
  mfaSelectionToken?: string;

  @ApiPropertyOptional({
    description:
      'Identifier of the MFA challenge to verify. Present only when MFA is required.',
    example: '7f4cf4e2-31ef-4a1c-a129-0d678b8d3201',
  })
  challengeId?: string;

  @ApiPropertyOptional({
    description:
      'MFA method selected for this challenge. Email OTP is the default staff factor.',
    example: 'email-otp',
  })
  mfaMethod?: string;

  @ApiPropertyOptional({
    description:
      'MFA methods the user may choose before the provider challenge is created.',
    example: ['email-otp', 'sms-otp', 'totp', 'webauthn', 'recovery-code'],
  })
  availableMfaMethods?: string[];

  @ApiPropertyOptional({
    description:
      'Default MFA method to highlight in the UI before the user chooses a factor.',
    example: 'email-otp',
  })
  preferredMfaMethod?: string;

  @ApiPropertyOptional({
    description:
      'Provider-specific data needed by the client to complete the issued MFA challenge.',
    example: { options: { challenge: 'base64url-challenge' } },
  })
  mfaChallengeMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Indicates whether the client should prompt the user to set up a passkey after successful login.',
    example: true,
  })
  promptPasswordlessSetup?: boolean;

  @ApiPropertyOptional({
    description:
      'User-facing passkey setup prompt shown after successful non-WebAuthn login.',
    example: {
      title: 'Set up faster sign-in',
      message:
        'Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.',
      setupUrl: '/console?section=security',
    },
  })
  passwordlessSetupPrompt?: {
    title: string;
    message: string;
    setupUrl: string;
  };

  @ApiProperty({
    description: 'Authenticated user payload.',
    type: () => UserResponseDto,
  })
  user: UserResponseDto;
}
