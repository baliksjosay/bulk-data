import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('database.host'),
  port: configService.get<number>('database.port'),
  username: configService.get<string>('database.username'),
  password: configService.get<string>('database.password'),
  database: configService.get<string>('database.name'),
  autoLoadEntities: true,
  synchronize: configService.get<boolean>('database.synchronize', false),
  logging: configService.get<boolean>('database.logging', false),
  ssl: configService.get<boolean>('database.ssl', false)
    ? { rejectUnauthorized: false }
    : false,
  extra: {
    max: configService.get<number>('database.poolSize', 20),
    connectionTimeoutMillis: 5000,
  },
});
