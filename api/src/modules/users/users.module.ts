import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { User } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UserRepository } from './repositories/user.repository';
import { UserPreferenceRepository } from './repositories/user-preference.repository';
import { UserSessionRepository } from './repositories/user-session.repository';
import { UserSession } from './entities/user-session.entity';
import { UserSessionsService } from './services/user-session.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { UserController } from './controllers/user.controller';
import { UserSessionsController } from './controllers/user-session.controller';
import { UserPreferencesController } from './controllers/user-preferences.controller';

/**
 * Users Module
 *
 * Manages user profiles, preferences, and account settings
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, UserPreference, UserSession])],
  controllers: [UserController, UserSessionsController, UserPreferencesController],
  providers: [
    UserService,
    UserSessionsService,
    UserPreferencesService,
    UserRepository,
    UserSessionRepository,
    UserPreferenceRepository,
  ],
  exports: [
    UserService,
    UserSessionsService,
    UserPreferencesService,
    UserRepository,
    UserSessionRepository,
    UserPreferenceRepository,
  ],
})
export class UserModule {}
