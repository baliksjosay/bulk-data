import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

/**
 * Resolves refresh-token payload from the refresh token presented
 * in the request body.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => request?.body?.refreshToken ?? null,
      ]),
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    request: any,
    payload: TokenPayload,
  ): Promise<AuthenticatedUser> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type for refresh');
    }

    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
      authProvider: payload.authProvider,
      sessionId: payload.sessionId,
      refreshToken: request?.body?.refreshToken,
    };
  }
}
