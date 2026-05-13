import { SetMetadata } from '@nestjs/common';
export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Rate Limit decorator
 * Override default rate limits for specific routes
 *
 * @param limit - Maximum requests
 * @param ttl - Time window in seconds
 *
 * @example
 * @RateLimit({ limit: 5, ttl: 60 })
 * @Post('login')
 * login() { ... }
 */
export const RateLimit = (options: { limit: number; ttl: number }) =>
  SetMetadata(RATE_LIMIT_KEY, options);
