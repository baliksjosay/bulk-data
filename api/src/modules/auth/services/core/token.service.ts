import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../../users/entities/user.entity';
import { TokenPayload } from '../../interfaces/token-payload.interface';
import { AuthEntryMethod } from '../../enums/auth-entry-method.enum';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { MfaMethod } from '../../enums/mfa-method.enum';

/**
 * Generates and verifies access, refresh, and MFA challenge tokens.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateAccessToken(user: User, sessionId: string): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      authProvider: user.authProvider,
      sessionId,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
  }

  generateRefreshToken(user: User, sessionId: string): string {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      authProvider: user.authProvider,
      sessionId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '30d',
    });
  }

  generateMfaChallengeToken(input: {
    user: User;
    entryMethod: AuthEntryMethod;
    authProvider?: AuthProvider;
    riskScore?: number;
    challengeId: string;
    deviceId?: string;
    mfaMethod: MfaMethod;
  }): string {
    const payload = {
      sub: input.user.id,
      email: input.user.email,
      roles: input.user.roles,
      authProvider: input.user.authProvider,
      type: 'mfa_challenge',
      entryMethod: input.entryMethod,
      originalAuthProvider: input.authProvider ?? input.user.authProvider,
      challengeId: input.challengeId,
      riskScore: input.riskScore ?? 0,
      deviceId: input.deviceId ?? null,
      mfaMethod: input.mfaMethod,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '10m',
    });
  }

  generateMfaSelectionToken(input: {
    user: User;
    entryMethod: AuthEntryMethod;
    authProvider?: AuthProvider;
    riskScore?: number;
    deviceId?: string;
  }): string {
    const payload = {
      sub: input.user.id,
      email: input.user.email,
      roles: input.user.roles,
      authProvider: input.user.authProvider,
      type: 'mfa_selection',
      entryMethod: input.entryMethod,
      originalAuthProvider: input.authProvider ?? input.user.authProvider,
      riskScore: input.riskScore ?? 0,
      deviceId: input.deviceId ?? null,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '10m',
    });
  }

  verify(token: string): TokenPayload & Record<string, any> {
    return this.jwtService.verify(token);
  }

  decode(token: string): (TokenPayload & Record<string, any>) | null {
    return this.jwtService.decode(token);
  }

  verifyMfaChallengeToken(token: string): TokenPayload & Record<string, any> {
    const payload = this.jwtService.verify(token);

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException('Invalid MFA challenge token');
    }

    return payload;
  }

  verifyMfaSelectionToken(token: string): TokenPayload & Record<string, any> {
    const payload = this.jwtService.verify(token);

    if (payload.type !== 'mfa_selection') {
      throw new UnauthorizedException('Invalid MFA selection token');
    }

    return payload;
  }
}
