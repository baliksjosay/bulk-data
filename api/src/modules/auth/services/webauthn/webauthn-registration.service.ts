import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers'; 
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';

import { WebauthnCredential } from '../../entities/webauthn-credential.entity';
import { UserService } from 'src/modules/users/services/user.service';
import { RedisService } from 'src/modules/redis/redis.service';

/**
 * Handles WebAuthn registration ceremonies.
 */
@Injectable()
export class WebauthnRegistrationService {
  private readonly challengeTtlSeconds = 10 * 60;

  constructor(
    @InjectRepository(WebauthnCredential)
    private readonly webauthnCredentialRepo: Repository<WebauthnCredential>,
    private readonly usersService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Begins a WebAuthn registration ceremony for an authenticated user.
   */
  async beginRegistration(
    userId: string,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const user = await this.usersService.requireById(userId);

    const existingCredentials = await this.webauthnCredentialRepo.find({
      where: {
        userId,
        isEnabled: true,
      },
      order: {
        isPrimary: 'DESC',
        createdAt: 'ASC',
      },
    });

    const excludeCredentials = existingCredentials.map((credential) => ({
      id: credential.credentialId,
      type: 'public-key' as const,
      transports: this.parseTransports(credential.transports),
    }));

    const options = await generateRegistrationOptions({
      rpName: this.configService.get<string>('webauthn.rpName', 'Bulk Data Wholesale'),
      rpID: this.configService.get<string>('webauthn.rpId', 'localhost'),
      userID:isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName:
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    await this.redisService.set(
      this.getRegistrationChallengeKey(userId),
      {
        challenge: options.challenge,
      },
      this.challengeTtlSeconds,
    );

    return options;
  }

  /**
   * Completes a WebAuthn registration ceremony and persists the credential.
   */
  async finishRegistration(
    userId: string,
    attestation: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    credentialId?: string;
    deviceType?: string;
    backedUp?: boolean;
  }> {
    const user = await this.usersService.requireById(userId);

    const parsed = this.asRegistrationResponseJSON(attestation);
    if (!parsed) {
      throw new BadRequestException('Invalid attestation payload');
    }

    const storedChallenge = await this.redisService.get<{
      challenge: string;
    }>(this.getRegistrationChallengeKey(userId));

    if (!storedChallenge?.challenge) {
      throw new BadRequestException(
        'Registration challenge not found or expired',
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: parsed,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: this.configService.get<string>('webauthn.rpId', 'localhost'),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'webauthn_registration_verification_failed',
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('WebAuthn registration was not verified');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const existing = await this.webauthnCredentialRepo.findOne({
      where: {
        credentialId: credential.id,
      },
    });

    if (existing) {
      throw new BadRequestException('Credential is already registered');
    }

    const entity = this.webauthnCredentialRepo.create({
      userId: user.id,
      credentialId: credential.id,
      publicKey: this.uint8ArrayToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: this.stringifyTransports(
        parsed.response.transports as string[] | undefined,
      ),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      isEnabled: true,
      isPrimary: false,
      label: `${credentialDeviceType ?? 'webauthn'} credential`,
    });

    await this.webauthnCredentialRepo.save(entity);
    await this.redisService.del(this.getRegistrationChallengeKey(userId));

    return {
      success: true,
      credentialId: entity.credentialId,
      deviceType: entity.deviceType ?? undefined,
      backedUp: entity.backedUp,
    };
  }

  private getRegistrationChallengeKey(userId: string): string {
    return `webauthn:registration:challenge:${userId}`;
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

  private parseTransports(
    transports?: string | null,
  ): AuthenticatorTransportFuture[] | undefined {
    if (!transports) return undefined;

    return transports
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as AuthenticatorTransportFuture[];
  }

  private stringifyTransports(transports?: string[]): string | null {
    if (!transports?.length) return null;
    return transports.join(',');
  }

  private uint8ArrayToBase64Url(value: Uint8Array): string {
    return Buffer.from(value)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private asRegistrationResponseJSON(
    value: Record<string, unknown>,
  ): RegistrationResponseJSON | null {
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
      typeof response.attestationObject !== 'string' ||
      typeof response.clientDataJSON !== 'string'
    ) {
      return null;
    }

    return value as unknown as RegistrationResponseJSON;
  }
}
