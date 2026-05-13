import { Injectable } from '@nestjs/common';
import { MfaMethod, MfaProvider } from '../interfaces/mfa-provider.interface';

@Injectable()
export class MfaService {
  private readonly providers = new Map<MfaMethod, MfaProvider>();

  register(provider: MfaProvider) {
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
    context?: Record<string, any>,
  ) {
    return this.getProvider(method).createChallenge(userId, context);
  }

  async verifyChallenge(
    method: MfaMethod,
    userId: string,
    challengeId: string,
    response: Record<string, any>,
  ) {
    return this.getProvider(method).verifyChallenge(
      userId,
      challengeId,
      response,
    );
  }
}
