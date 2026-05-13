import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';

import { WebauthnCredential } from '../../entities/webauthn-credential.entity';
import { UserService } from 'src/modules/users/services/user.service';
import { RedisService } from 'src/modules/redis/redis.service';

@Injectable()
export class WebauthnAuthenticationService {
  constructor(
    @InjectRepository(WebauthnCredential)
    private readonly webauthnCredentialRepo: Repository<WebauthnCredential>,
    private readonly usersService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async beginAuthentication(input: {
    email?: string;
    userId?: string;
  }): Promise<PublicKeyCredentialRequestOptionsJSON> {
    let userId = input.userId;

    if (!userId && input.email) {
      const user = await this.usersService.findByEmail(input.email);
      userId = user?.id;
    }

    const allowCredentials = userId
      ? await this.getAllowCredentialsForUser(userId)
      : undefined;

    const options = await generateAuthenticationOptions({
      rpID: this.getRpId(),
      timeout: 60000,
      allowCredentials: allowCredentials?.length ? allowCredentials : undefined,
      userVerification: 'required',
    });

    await this.redisService.set(
      this.getAuthenticationChallengeKey(options.challenge),
      {
        userId: userId ?? null,
        challenge: options.challenge,
        createdAt: new Date().toISOString(),
      },
      60 * 5,
    );

    return options;
  }

  private getAuthenticationChallengeKey(challenge: string): string {
    return `webauthn:auth:challenge:${challenge}`;
  }

  private async getAllowCredentialsForUser(userId: string) {
    const credentials = await this.webauthnCredentialRepo.find({
      where: {
        userId,
        isEnabled: true,
      },
      order: {
        isPrimary: 'DESC',
        createdAt: 'ASC',
      },
    });

    return credentials.map((credential) => ({
      id: credential.credentialId,
      type: 'public-key' as const,
      transports: this.parseTransports(credential.transports),
    }));
  }
  /**
   * Completes a WebAuthn authentication ceremony and infers the user from
   * the credential id contained in the browser assertion.
   */
  async finishAuthentication(input: {
    assertion: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    reason?: string;
    userId?: string;
    credentialId?: string;
    newCounter?: number;
  }> {
    const assertion = this.asAuthenticationResponseJSON(input.assertion);

    if (!assertion) {
      return {
        success: false,
        reason: 'invalid_assertion_payload',
      };
    }

    const clientChallenge = this.extractChallengeFromAssertion(assertion);
    if (!clientChallenge) {
      return {
        success: false,
        reason: 'missing_client_challenge',
      };
    }

    const stored = await this.redisService.get<{
      userId: string | null;
      challenge: string;
      createdAt: string;
    }>(this.getAuthenticationChallengeKey(clientChallenge));

    if (!stored?.challenge) {
      return {
        success: false,
        reason: 'authentication_challenge_not_found_or_expired',
      };
    }

    const credential = await this.webauthnCredentialRepo.findOne({
      where: {
        credentialId: assertion.id,
        isEnabled: true,
      },
    });

    if (!credential) {
      return {
        success: false,
        reason: 'credential_not_found',
      };
    }

    if (stored.userId && credential.userId !== stored.userId) {
      return {
        success: false,
        reason: 'challenge_user_mismatch',
      };
    }

    const publicKeyBytes = this.toWebAuthnPublicKey(credential.publicKey);

    const storedCredential: WebAuthnCredential = {
      id: credential.credentialId,
      publicKey: publicKeyBytes,
      counter: Number(credential.counter ?? 0),
      transports: this.parseTransports(credential.transports),
    };

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: stored.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: this.getRpId(),
        credential: storedCredential,
      });
    } catch (error) {
      return {
        success: false,
        reason:
          error instanceof Error
            ? error.message
            : 'webauthn_verification_failed',
      };
    }

    if (!verification.verified) {
      return {
        success: false,
        reason: 'webauthn_assertion_not_verified',
      };
    }

    credential.counter = verification.authenticationInfo.newCounter;
    await this.webauthnCredentialRepo.save(credential);

    await this.redisService.del(
      this.getAuthenticationChallengeKey(clientChallenge),
    );

    return {
      success: true,
      userId: credential.userId,
      credentialId: credential.credentialId,
      newCounter: verification.authenticationInfo.newCounter,
    };
  }

  private extractChallengeFromAssertion(
    assertion: AuthenticationResponseJSON,
  ): string | null {
    try {
      const json = Buffer.from(
        assertion.response.clientDataJSON,
        'base64url',
      ).toString('utf8');
      const parsed = JSON.parse(json) as { challenge?: string };
      return typeof parsed.challenge === 'string' ? parsed.challenge : null;
    } catch {
      return null;
    }
  }

  private asAuthenticationResponseJSON(
    value: Record<string, unknown>,
  ): AuthenticationResponseJSON | null {
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof value.id !== 'string' ||
      typeof value.rawId !== 'string' ||
      typeof value.type !== 'string' ||
      typeof value.response !== 'object' ||
      value.response === null ||
      typeof value.clientExtensionResults !== 'object' ||
      value.clientExtensionResults === null
    ) {
      return null;
    }

    const response = value.response as Record<string, unknown>;

    if (
      typeof response.authenticatorData !== 'string' ||
      typeof response.clientDataJSON !== 'string' ||
      typeof response.signature !== 'string'
    ) {
      return null;
    }

    if (
      response.userHandle !== undefined &&
      response.userHandle !== null &&
      typeof response.userHandle !== 'string'
    ) {
      return null;
    }

    return value as unknown as AuthenticationResponseJSON;
  }

  private toWebAuthnPublicKey(value: string): Uint8Array<ArrayBuffer> {
    const trimmed = value.trim();

    let bytes: Uint8Array;

    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed) as number[];
      bytes = Uint8Array.from(parsed);
    } else {
      const base64 = this.base64UrlToBase64(trimmed);
      bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
    }

    const out = new Uint8Array(new ArrayBuffer(bytes.length));
    out.set(bytes);
    return out;
  }

  private parseTransports(
    transports?: string | null,
  ): AuthenticatorTransportFuture[] | undefined {
    if (!transports) return undefined;

    return transports
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as AuthenticatorTransportFuture[];
  }

  private getExpectedOrigins(): string[] {
    const configured = process.env.WEBAUTHN_EXPECTED_ORIGINS?.trim();
    if (configured) {
      return configured
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }

    return [
      this.configService.get<string>('webauthn.origin', 'http://localhost:3000'),
    ];
  }

  private getRpId(): string {
    return this.configService.get<string>('webauthn.rpId', 'localhost');
  }

  private base64UrlToBase64(value: string): string {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = padded.length % 4;

    if (remainder === 0) return padded;
    if (remainder === 2) return `${padded}==`;
    if (remainder === 3) return `${padded}=`;

    return padded;
  }
}
