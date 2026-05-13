import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { AuthProvider } from '../../enums/auth-provider.enum';

/**
 * Verifies Google identity tokens and extracts trusted user identity claims.
 */
@Injectable()
export class GoogleTokenVerifierService {
  private readonly client: OAuth2Client;
  private readonly audience: string;

  constructor(private readonly configService: ConfigService) {
    this.audience = this.configService.get<string>('google.clientId') ?? '';
    this.client = new OAuth2Client(this.audience);
  }

  async verify(idToken: string): Promise<{
    externalId: string;
    email: string;
    firstName: string;
    lastName: string;
    provider: AuthProvider.GOOGLE;
  }> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.audience,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid Google identity token');
    }

    return {
      externalId: payload.sub,
      email: payload.email,
      firstName: payload.given_name ?? '',
      lastName: payload.family_name ?? '',
      provider: AuthProvider.GOOGLE,
    };
  }
}
