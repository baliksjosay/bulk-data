export enum MfaMethod {
  TOTP = 'TOTP',
  SMS_OTP = 'SMS_OTP',
  EMAIL_OTP = 'EMAIL_OTP',
  WEBAUTHN = 'WEBAUTHN',
  HARDWARE_KEY = 'HARDWARE_KEY',
}

export interface MfaChallengeResult {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface MfaVerificationResult {
  success: boolean;
  reason?: string;
}

export interface MfaProvider {
  readonly method: MfaMethod;

  isAvailable(): boolean;

  createChallenge(
    userId: string,
    context?: Record<string, any>,
  ): Promise<MfaChallengeResult>;

  verifyChallenge(
    userId: string,
    challengeId: string,
    response: Record<string, any>,
  ): Promise<MfaVerificationResult>;
}
