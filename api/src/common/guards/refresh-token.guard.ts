import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Enforces refresh-token authentication.
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
