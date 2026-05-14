import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { UserService } from 'src/modules/users/services/user.service';

type ActiveDirectoryLoginResponse = {
  userName?: unknown;
  username?: unknown;
  lanId?: unknown;
  samAccountName?: unknown;
  displayName?: unknown;
  name?: unknown;
  firstName?: unknown;
  firstname?: unknown;
  givenName?: unknown;
  lastName?: unknown;
  lastname?: unknown;
  surname?: unknown;
  sn?: unknown;
  phoneNumber?: unknown;
  mobile?: unknown;
  telephoneNumber?: unknown;
  emailAddress?: unknown;
  email?: unknown;
  mail?: unknown;
  authenticated?: unknown;
  authSystemError?: unknown;
  authUserError?: unknown;
  message?: unknown;
};

type ActiveDirectoryWrappedResponse = {
  data?: ActiveDirectoryLoginResponse;
};

export type ActiveDirectoryAuthenticatedProfile = {
  username: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  emailAddress?: string;
};

@Injectable()
export class LocalActiveDirectoryService {
  private readonly logger = new Logger(LocalActiveDirectoryService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getActiveDirectoryUrl());
  }

  async initiateLogin(
    user: User,
    data: {
      username: string;
      password: string;
    },
  ): Promise<User> {
    this.assertStaffUser(user);

    const profile = await this.authenticate(data);

    return this.syncAuthenticatedProfile(user, profile);
  }

  async authenticate(data: {
    username: string;
    password: string;
  }): Promise<ActiveDirectoryAuthenticatedProfile> {
    const username = data.username.trim();

    if (!username || !data.password) {
      throw new BadRequestException(
        'Directory username and password are required',
      );
    }

    const activeDirectoryUrl = this.getActiveDirectoryUrl();

    if (!activeDirectoryUrl) {
      throw new ServiceUnavailableException(
        'Directory authentication is not configured',
      );
    }

    const timeout = this.getActiveDirectoryTimeoutMs();

    try {
      const response = await firstValueFrom(
        this.httpService.post<
          ActiveDirectoryLoginResponse | ActiveDirectoryWrappedResponse
        >(
          activeDirectoryUrl,
          {
            username,
            password: data.password,
          },
          { timeout },
        ),
      );

      if (!response.data) {
        throw new Error('Directory service unavailable');
      }

      const payload = this.unwrapResponse(response.data);
      const authSystemError = this.readString(payload, ['authSystemError']);
      const authUserError = this.readString(payload, ['authUserError']);

      if (authSystemError) {
        this.logger.error(
          JSON.stringify({
            event: 'directory_authentication_system_error',
            username,
            reason: authSystemError,
          }),
        );
        throw new ServiceUnavailableException(
          'Directory authentication is unavailable',
        );
      }

      if (authUserError) {
        this.logger.warn(
          JSON.stringify({
            event: 'directory_authentication_user_error',
            username,
            reason: authUserError,
          }),
        );
        throw new UnauthorizedException('Authentication failed');
      }

      if (!this.isAuthenticated(payload.authenticated)) {
        throw new UnauthorizedException('Invalid username or password');
      }

      return this.toAuthenticatedProfile(payload, username);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        JSON.stringify({
          event: 'directory_authentication_error',
          username,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown directory error',
        }),
      );

      throw new ServiceUnavailableException(
        'Directory authentication is unavailable',
      );
    }
  }

  async syncAuthenticatedProfile(
    user: User,
    profile: ActiveDirectoryAuthenticatedProfile,
  ): Promise<User> {
    this.assertStaffUser(user);

    return this.userService.syncActiveDirectoryProfile(user.id, profile);
  }

  private getActiveDirectoryUrl(): string {
    return (
      this.configService.get<string>('identityProviders.activeDirectory.url') ||
      this.configService.get<string>('MTNAD_LOGIN_URL') ||
      this.configService.get<string>('MTN_AD_LOGIN_URL') ||
      this.configService.get<string>('LDAP_API_SERVICE') ||
      ''
    ).trim();
  }

  private getActiveDirectoryTimeoutMs(): number {
    return (
      this.configService.get<number>(
        'identityProviders.activeDirectory.timeoutMs',
      ) ||
      this.configService.get<number>('MTN_AD_LOGIN_TIMEOUT_MS') ||
      this.configService.get<number>('LDAP_API_TIMEOUT_MS') ||
      60000
    );
  }

  private unwrapResponse(
    response: ActiveDirectoryLoginResponse | ActiveDirectoryWrappedResponse,
  ): ActiveDirectoryLoginResponse {
    if (
      response &&
      typeof response === 'object' &&
      'data' in response &&
      response.data
    ) {
      return response.data;
    }

    return response as ActiveDirectoryLoginResponse;
  }

  private isAuthenticated(
    value: ActiveDirectoryLoginResponse['authenticated'],
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
  }

  private toAuthenticatedProfile(
    response: ActiveDirectoryLoginResponse,
    fallbackUsername: string,
  ): ActiveDirectoryAuthenticatedProfile {
    const firstName = this.readString(response, [
      'firstName',
      'firstname',
      'givenName',
    ]);
    const lastName = this.readString(response, [
      'lastName',
      'lastname',
      'surname',
      'sn',
    ]);
    const username =
      this.readString(response, [
        'userName',
        'username',
        'lanId',
        'samAccountName',
      ]) ?? fallbackUsername;
    const composedDisplayName = [firstName, lastName].filter(Boolean).join(' ');
    const displayName =
      (this.readString(response, ['displayName', 'name']) ??
        composedDisplayName) ||
      undefined;
    const phoneNumber = this.readString(response, [
      'phoneNumber',
      'mobile',
      'telephoneNumber',
    ]);
    const emailAddress = this.readString(response, [
      'emailAddress',
      'email',
      'mail',
    ]);

    return {
      username: username.toLowerCase(),
      ...(displayName ? { displayName } : {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(emailAddress ? { emailAddress: emailAddress.toLowerCase() } : {}),
    };
  }

  private readString(
    response: ActiveDirectoryLoginResponse,
    keys: Array<keyof ActiveDirectoryLoginResponse>,
  ): string | undefined {
    for (const key of keys) {
      const value = response[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (typeof value === 'number') {
        return value.toString();
      }
    }

    return undefined;
  }

  private assertStaffUser(user: User): void {
    if (!this.isStaffUser(user)) {
      throw new ForbiddenException(
        'This account does not support directory authentication',
      );
    }
  }

  private isStaffUser(user: User): boolean {
    return user.roles.some((role) =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
    );
  }
}
