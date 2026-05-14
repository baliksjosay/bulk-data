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
import { UserAuthFactor } from '../../entities/user-auth-factor.entity';
import { AuthFactorType } from '../../enums/auth-factor-type.enum';
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
    @InjectRepository(UserAuthFactor)
    private readonly factorRepo: Repository<UserAuthFactor>,
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
      rpName: this.configService.get<string>(
        'webauthn.rpName',
        'Bulk Data Wholesale',
      ),
      rpID: this.configService.get<string>('webauthn.rpId', 'localhost'),
      userID: isoUint8Array.fromUTF8String(user.id),
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
    id?: string;
    label?: string;
    credentialId?: string;
    transports?: AuthenticatorTransportFuture[];
    deviceType?: string;
    backedUp?: boolean;
    createdAt?: string;
    lastUsedAt?: string;
    status?: 'active' | 'revoked';
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
        expectedRPID: this.configService.get<string>(
          'webauthn.rpId',
          'localhost',
        ),
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
    await this.enableWebauthnFactor(user.id, entity);
    await this.redisService.del(this.getRegistrationChallengeKey(userId));

    return {
      success: true,
      ...this.serializeCredential(entity),
    };
  }

  async listCredentials(userId: string): Promise<
    Array<{
      id: string;
      label: string;
      credentialId: string;
      transports: AuthenticatorTransportFuture[];
      createdAt: string;
      lastUsedAt: string;
      status: 'active' | 'revoked';
    }>
  > {
    const credentials = await this.webauthnCredentialRepo.find({
      where: { userId },
      order: {
        isEnabled: 'DESC',
        createdAt: 'DESC',
      },
    });

    return credentials.map((credential) =>
      this.serializeCredential(credential),
    );
  }

  async revokeCredential(userId: string, credentialIdOrId: string) {
    const credential = await this.webauthnCredentialRepo.findOne({
      where: [
        { id: credentialIdOrId, userId },
        { credentialId: credentialIdOrId, userId },
      ],
    });

    if (!credential) {
      throw new BadRequestException('WebAuthn credential was not found');
    }

    credential.isEnabled = false;
    const saved = await this.webauthnCredentialRepo.save(credential);

    const remainingEnabledCredentials = await this.webauthnCredentialRepo.count(
      {
        where: {
          userId,
          isEnabled: true,
        },
      },
    );

    if (remainingEnabledCredentials === 0) {
      const factor = await this.factorRepo.findOne({
        where: {
          userId,
          type: AuthFactorType.WEBAUTHN,
        },
      });

      if (factor) {
        factor.isEnabled = false;
        await this.factorRepo.save(factor);
      }
    }

    return this.serializeCredential(saved);
  }

  private async enableWebauthnFactor(
    userId: string,
    credential: WebauthnCredential,
  ): Promise<void> {
    let factor = await this.factorRepo.findOne({
      where: {
        userId,
        type: AuthFactorType.WEBAUTHN,
      },
    });

    if (!factor) {
      factor = this.factorRepo.create({
        userId,
        type: AuthFactorType.WEBAUTHN,
        label: 'Passkey',
        isEnabled: true,
        isVerified: true,
        isPrimary: false,
      });
    }

    factor.isEnabled = true;
    factor.isVerified = true;
    factor.publicMetadata = {
      ...(factor.publicMetadata ?? {}),
      lastCredentialId: credential.credentialId,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
    };

    await this.factorRepo.save(factor);
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
      this.configService.get<string>(
        'webauthn.origin',
        'http://localhost:3000',
      ),
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

  private serializeCredential(credential: WebauthnCredential): {
    id: string;
    label: string;
    credentialId: string;
    transports: AuthenticatorTransportFuture[];
    deviceType?: string;
    backedUp: boolean;
    createdAt: string;
    lastUsedAt: string;
    status: 'active' | 'revoked';
  } {
    return {
      id: credential.id,
      label: credential.label ?? 'Passkey',
      credentialId: credential.credentialId,
      transports: this.parseTransports(credential.transports) ?? [],
      deviceType: credential.deviceType ?? undefined,
      backedUp: credential.backedUp,
      createdAt: credential.createdAt.toISOString(),
      lastUsedAt: credential.updatedAt.toISOString(),
      status: credential.isEnabled ? 'active' : 'revoked',
    };
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
