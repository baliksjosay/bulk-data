import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { redisCacheConfig } from 'src/config/redis.config';

@Global()
@Module({
  imports: [CacheModule.registerAsync(redisCacheConfig)],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
