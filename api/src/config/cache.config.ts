import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-ioredis';

export const cacheConfig = async (
  config: ConfigService,
): Promise<CacheModuleOptions> => ({
  isGlobal: true,
  store: redisStore.create({
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD'),
    ttl: 600,
  }),
});
