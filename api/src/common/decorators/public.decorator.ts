import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public route decorator
 * Marks routes as publicly accessible (no authentication required)
 *
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { return { status: 'ok' }; }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
