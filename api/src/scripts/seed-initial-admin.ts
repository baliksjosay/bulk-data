import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseConfig } from 'src/config/database.config';
import { configuration } from 'src/config';
import { validationSchema } from 'src/config/validation.schema';
import { UserPreference } from 'src/modules/users/entities/user-preference.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { UserSession } from 'src/modules/users/entities/user-session.entity';
import {
  InitialAdminSeedInput,
  InitialAdminSeedService,
} from 'src/modules/users/services/initial-admin-seed.service';
import { UserPreferenceRepository } from 'src/modules/users/repositories/user-preference.repository';
import { UserRepository } from 'src/modules/users/repositories/user.repository';

type CliSeedOptions = Partial<InitialAdminSeedInput>;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseConfig(config),
        entities: [User, UserPreference, UserSession],
      }),
    }),
    TypeOrmModule.forFeature([User, UserPreference, UserSession]),
  ],
  providers: [
    InitialAdminSeedService,
    UserRepository,
    UserPreferenceRepository,
  ],
})
class SeedInitialAdminModule {}

const logger = new Logger('SeedInitialAdmin');

function parseCliSeedOptions(argv: string[]): CliSeedOptions {
  const options: CliSeedOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split('=', 2);

    if (flag === '--reset-password') {
      options.resetPassword = true;
      continue;
    }

    if (flag === '--no-reset-password') {
      options.resetPassword = false;
      continue;
    }

    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined && value && !value.startsWith('--')) {
      index += 1;
    }

    switch (flag) {
      case '--email':
        options.email = value;
        break;
      case '--password':
        options.password = value;
        break;
      case '--phone':
        options.phoneNumber = value;
        break;
      case '--first-name':
        options.firstName = value;
        break;
      case '--last-name':
        options.lastName = value;
        break;
      default:
        break;
    }
  }

  return options;
}

function applyCliOptionsToEnvironment(options: CliSeedOptions): void {
  process.env.BOOTSTRAP_LOCAL_ADMIN = 'true';
  setEnvironmentValue(
    'BOOTSTRAP_LOCAL_ADMIN_EMAIL',
    options.email ??
      process.env.BOOTSTRAP_LOCAL_ADMIN_EMAIL ??
      process.env.INITIAL_ADMIN_EMAIL,
  );
  setEnvironmentValue(
    'BOOTSTRAP_LOCAL_ADMIN_PASSWORD',
    options.password ??
      process.env.BOOTSTRAP_LOCAL_ADMIN_PASSWORD ??
      process.env.INITIAL_ADMIN_PASSWORD,
  );
  setEnvironmentValue(
    'BOOTSTRAP_LOCAL_ADMIN_PHONE',
    options.phoneNumber ??
      process.env.BOOTSTRAP_LOCAL_ADMIN_PHONE ??
      process.env.INITIAL_ADMIN_PHONE,
  );
  setEnvironmentValue(
    'BOOTSTRAP_LOCAL_ADMIN_FIRST_NAME',
    options.firstName ??
      process.env.BOOTSTRAP_LOCAL_ADMIN_FIRST_NAME ??
      process.env.INITIAL_ADMIN_FIRST_NAME,
  );
  setEnvironmentValue(
    'BOOTSTRAP_LOCAL_ADMIN_LAST_NAME',
    options.lastName ??
      process.env.BOOTSTRAP_LOCAL_ADMIN_LAST_NAME ??
      process.env.INITIAL_ADMIN_LAST_NAME,
  );

  if (options.resetPassword !== undefined) {
    process.env.BOOTSTRAP_LOCAL_ADMIN_RESET_PASSWORD = String(
      options.resetPassword,
    );
  }
}

function setEnvironmentValue(name: string, value?: string): void {
  if (value !== undefined) {
    process.env[name] = value;
  }
}

async function bootstrap(): Promise<void> {
  applyCliOptionsToEnvironment(parseCliSeedOptions(process.argv.slice(2)));

  const app = await NestFactory.createApplicationContext(
    SeedInitialAdminModule,
    {
      logger: ['log', 'warn', 'error'],
    },
  );

  try {
    const seeder = app.get(InitialAdminSeedService);
    const result = await seeder.seedFromEnvironment();

    logger.log(
      JSON.stringify({
        event: 'seed_initial_admin_script',
        outcome: result.created ? 'created' : 'updated',
        userId: result.userId,
        email: result.email,
        passwordUpdated: result.passwordUpdated,
      }),
    );
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed error';
  logger.error(message);
  process.exitCode = 1;
});
