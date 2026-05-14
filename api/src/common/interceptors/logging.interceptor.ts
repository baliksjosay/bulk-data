import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logging Interceptor
 * Logs request/response for debugging and monitoring
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    this.logger.log(
      JSON.stringify({
        event: 'http_request_received',
        method,
        url,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const delay = Date.now() - now;

          this.logger.log(
            JSON.stringify({
              event: 'http_request_completed',
              method,
              url,
              statusCode,
              durationMs: delay,
            }),
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            JSON.stringify({
              event: 'http_request_failed',
              method,
              url,
              errorName: error instanceof Error ? error.name : 'UnknownError',
              message:
                error instanceof Error ? error.message : 'Request failed',
              durationMs: delay,
            }),
          );
        },
      }),
    );
  }
}
