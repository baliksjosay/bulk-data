import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AuthProvider } from '../../enums/auth-provider.enum';

/**
 * Verifies Microsoft identity tokens and extracts trusted user identity claims.
 */
@Injectable()
export class MicrosoftTokenVerifierService {
  private readonly audience: string;
  private readonly issuer: string;
  private readonly client: jwksClient.JwksClient;

  constructor(private readonly configService: ConfigService) {
    const tenantId = this.configService.get<string>('microsoft.tenantId');
    this.audience = this.configService.get<string>('microsoft.clientId') ?? '';
    this.issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

    this.client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
    });
  }

  async verify(idToken: string): Promise<{
    externalId: string;
    email: string;
    firstName: string;
    lastName: string;
    provider: AuthProvider.MICROSOFT;
  }> {
    const decoded = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        idToken,
        (header, callback) => {
          this.client.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key?.getPublicKey());
          });
        },
        {
          audience: this.audience,
          issuer: this.issuer,
        },
        (err, payload) => {
          if (err) return reject(err);
          resolve(payload);
        },
      );
    });

    if (!decoded?.oid && !decoded?.sub) {
      throw new UnauthorizedException('Invalid Microsoft identity token');
    }

    const fullName = String(decoded.name ?? '').trim();
    const [firstName, ...rest] = fullName.split(' ');

    return {
      externalId: String(decoded.oid ?? decoded.sub),
      email: String(decoded.preferred_username ?? decoded.email ?? ''),
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      provider: AuthProvider.MICROSOFT,
    };
  }
}
