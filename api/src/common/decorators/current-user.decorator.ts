import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type CurrentUserKey = keyof AuthenticatedUser | 'sessionId';

export const CurrentUser = createParamDecorator(
  (data: CurrentUserKey | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!data) {
      return user;
    }

    if (data === 'sessionId') {
      return user?.sessionId ?? request.sessionId;
    }

    return user?.[data];
  },
);
