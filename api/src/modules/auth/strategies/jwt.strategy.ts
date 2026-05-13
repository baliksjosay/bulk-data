import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TokenPayload } from '../interfaces/token-payload.interface';
import { UserService } from 'src/modules/users/services/user.service';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';

/**
 * Resolves authenticated user context from access tokens.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('jwt.accessSecret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: TokenPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.requireById(payload.sub);

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      roles: user.roles,
      authProvider: user.authProvider,
      sessionId: payload.sessionId,
    };
  }
}
