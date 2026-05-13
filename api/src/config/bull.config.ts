import { ConfigService } from '@nestjs/config';
import { BullRootModuleOptions } from '@nestjs/bullmq';

export const bullConfig = (config: ConfigService): BullRootModuleOptions => ({
  connection: {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    db: config.get<number>('REDIS_DB', 0),
    password: config.get<string>('REDIS_PASSWORD', ''),
  },
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1500 },
  },
});
