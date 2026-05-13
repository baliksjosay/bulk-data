import { Injectable } from '@nestjs/common';
import { MfaMethod } from '../../enums/mfa-method.enum';
import { MfaProvider } from '../../interfaces/mfa-provider.interface';
import { EmailOtpMfaProvider } from './providers/email-otp-mfa.provider';
import { SmsOtpMfaProvider } from './providers/sms-otp-mfa.provider';
import { TotpMfaProvider } from './providers/totp-mfa.provider';
import { WebauthnMfaProvider } from './providers/webauthn-mfa.provider';

/**
 * Orchestrates MFA providers and routes MFA challenges and verification.
 */
@Injectable()
export class MfaService {
  private readonly providers = new Map<MfaMethod, MfaProvider>();

  constructor(
    totpProvider: TotpMfaProvider,
    emailOtpProvider: EmailOtpMfaProvider,
    smsOtpProvider: SmsOtpMfaProvider,
    webauthnProvider: WebauthnMfaProvider,
  ) {
    [totpProvider, emailOtpProvider, smsOtpProvider, webauthnProvider].forEach(
      (provider) => this.register(provider),
    );
  }

  register(provider: MfaProvider): void {
    this.providers.set(provider.method, provider);
  }

  getProvider(method: MfaMethod): MfaProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`MFA provider ${method} is not registered`);
    }
    return provider;
  }

  async createChallenge(
    method: MfaMethod,
    userId: string,
    context?: Record<string, unknown>,
  ) {
    return this.getProvider(method).createChallenge(userId, context);
  }

  async verifyChallenge(
    method: MfaMethod,
    userId: string,
    challengeId: string,
    response: Record<string, unknown>,
  ) {
    return this.getProvider(method).verifyChallenge(
      userId,
      challengeId,
      response,
    );
  }
}
