import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { configuration } from './config';
import { validationSchema } from './config/validation.schema';
import { databaseConfig } from './config/database.config';
import { bullConfig } from './config/bull.config';
import { mailerConfig } from './config/mailer.config';
import { cacheConfig } from './config/cache.config';
// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'node:path';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { BulkDataModule } from './modules/bulk-data/bulk-data.module';
import { jwtConfig } from 'src/config/jwt-config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

const uploadDir = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR) // ✅ normalizes absolute/relative
  : resolve(process.cwd(), '..', 'data', 'uploads');

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseConfig(config),
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => jwtConfig(config),
    }),

    ScheduleModule.forRoot({
      cronJobs: true,
      intervals: true,
      timeouts: true,
    }),

    HttpModule.register({
      global: true,
      timeout: 5000,
      maxRedirects: 5,
    }),

    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => mailerConfig(config),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => bullConfig(config),
    }),
    EventEmitterModule.forRoot({
      global: true,
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => cacheConfig(config),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: uploadDir,
      serveRoot: '/public/', // Optional: Prefix for accessing static files (e.g., /output/output.html)
      // renderPath: '*', // Optional: Default is '*' to serve index.html for client-side routing
    }),
    RedisModule,
    NotificationsModule,
    // Feature Modules
    AuthModule,
    UserModule,
    HealthModule,
    ProvisioningModule,
    BulkDataModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
