import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AutoRefreshTokenInterceptor implements NestInterceptor {
  constructor(private readonly jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token || !request.user) {
      return next.handle();
    }

    try {
      const decoded = this.jwtService.decode(token);

      if (!decoded?.iat || !decoded?.exp) {
        return next.handle();
      }

      const now = Math.floor(Date.now() / 1000);
      const issuedAt = decoded.iat;
      const expiresAt = decoded.exp;
      const totalLifetime = expiresAt - issuedAt;
      const elapsedLifetime = now - issuedAt;

      if (totalLifetime > 0 && elapsedLifetime >= totalLifetime / 2) {
        const newAccessToken = this.jwtService.sign({
          sub: request.user.id,
          email: request.user.email,
          roles: request.user.roles,
          authProvider: request.user.authProvider,
          sessionId: decoded.sessionId,
        });

        reply.header('x-access-token', newAccessToken);
      }
    } catch {
      // ignore decode/sign failures here; JwtAuthGuard already handles validity
    }

    return next.handle();
  }
}
