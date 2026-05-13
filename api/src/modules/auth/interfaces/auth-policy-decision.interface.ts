import { AuthFactorType } from '../enums/auth-factor-type.enum';

/**
 * Represents the policy decision for an authentication attempt.
 */
export interface AuthPolicyDecision {
  allow: boolean;
  requiresEmailVerification: boolean;
  requiresPhoneVerification: boolean;
  recoveryCodePolicy: RecoveryCodePolicyStatus;
  requiresMfa: boolean;
  requiresStepUp: boolean;
  allowedFactors: AuthFactorType[];
  maxActiveSessions: number;
  risk: AuthRiskAssessment;
  reason?: string;
}

/**
 * Structured risk assessment result.
 */
export interface AuthRiskAssessment {
  score: number;
  suspicious: boolean;
  requiresStepUp: boolean;
  reasons: string[];
  metadata?: Record<string, unknown>;
}

export interface RecoveryCodePolicyStatus {
  warning: boolean;
  policyViolation: boolean;
  reason?: string;
}
