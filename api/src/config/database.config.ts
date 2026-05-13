import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: "postgres",
  host: configService.get<string>("DB_HOST"),
  port: Number.parseInt(configService.get<string>("DB_PORT"), 10),
  username: configService.get<string>("DB_USER"),
  password: configService.get<string>("DB_PASS"),
  database: configService.get<string>("DB_NAME"),
  entities: ["dist/**/*.entity{.ts,.js}"],
  synchronize: configService.get<string>("NODE_ENV") === "development",
  logging: false, //configService.get<string>("NODE_ENV") === "development",
  ssl:
    configService.get<string>("DB_SSL") === "true"
      ? { rejectUnauthorized: false }
      : false,
  extra: {
    max: 20,
    connectionTimeoutMillis: 5000,
  },
});
