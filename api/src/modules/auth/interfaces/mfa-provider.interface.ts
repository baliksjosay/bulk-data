import { MfaMethod } from '../enums/mfa-method.enum';

export interface MfaChallenge {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
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
    context?: Record<string, unknown>,
  ): Promise<MfaChallenge>;
  verifyChallenge(
    userId: string,
    challengeId: string,
    response: Record<string, unknown>,
  ): Promise<MfaVerificationResult>;
}
