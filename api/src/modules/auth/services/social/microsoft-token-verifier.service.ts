import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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
  private readonly tenantId: string;
  private readonly client: jwksClient.JwksClient;

  constructor(private readonly configService: ConfigService) {
    this.tenantId =
      this.configService.get<string>('oauth.microsoft.tenantId') ?? 'common';
    this.audience =
      this.configService.get<string>('oauth.microsoft.clientId') ?? '';

    this.client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${this.tenantId}/discovery/v2.0/keys`,
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
    if (!this.audience) {
      throw new ServiceUnavailableException('Microsoft SSO is not configured');
    }

    const acceptedIssuers = this.resolveAcceptedIssuers(idToken);

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
          issuer: acceptedIssuers,
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

  private resolveAcceptedIssuers(idToken: string): [string, ...string[]] {
    const decoded = jwt.decode(idToken);
    const payload =
      decoded && typeof decoded === 'object'
        ? (decoded as jwt.JwtPayload)
        : null;
    const tokenTenantId =
      typeof payload?.tid === 'string' && payload.tid.trim().length > 0
        ? payload.tid.trim()
        : null;

    if (this.isTenantIndependentConfig() && tokenTenantId) {
      return this.buildIssuerCandidates(tokenTenantId);
    }

    return this.buildIssuerCandidates(this.tenantId);
  }

  private isTenantIndependentConfig(): boolean {
    return ['common', 'organizations', 'consumers'].includes(
      this.tenantId.toLowerCase(),
    );
  }

  private buildIssuerCandidates(tenantId: string): [string, ...string[]] {
    return [
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`,
    ];
  }
}
