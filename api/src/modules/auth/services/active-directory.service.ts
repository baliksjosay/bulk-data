import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { UserService } from 'src/modules/users/services/user.service';

type ActiveDirectoryLoginResponse = {
  userName?: string;
  displayName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  authenticated?: boolean;
  authSystemError?: string;
  authUserError?: string;
};

@Injectable()
export class LocalActiveDirectoryService {
  private readonly logger = new Logger(LocalActiveDirectoryService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async initiateLogin(
    user: User,
    data: {
      username: string;
      password: string;
    },
  ): Promise<boolean> {
    if (!this.isStaffUser(user)) {
      throw new ForbiddenException(
        'Password login is available only to MTN staff users',
      );
    }

    const activeDirectoryUrl =
      this.configService.get<string>('MTNAD_LOGIN_URL') ||
      this.configService.get<string>('MTN_AD_LOGIN_URL');

    if (!activeDirectoryUrl) {
      throw new BadRequestException('MTN Active Directory URL is not configured');
    }

    const username = data.username.trim();

    try {
      const response = await firstValueFrom(
        this.httpService.post<ActiveDirectoryLoginResponse>(
          activeDirectoryUrl,
          {
            username,
            password: data.password,
          },
        ),
      );

      if (!response.data) {
        throw new Error('AD service unavailable');
      }

      const {
        userName,
        displayName,
        phoneNumber,
        emailAddress,
        authenticated,
        authSystemError,
        authUserError,
      } = response.data;

      if (authSystemError || authUserError) {
        const reason = authSystemError || authUserError;
        this.logger.error(`AD error for ${username}: ${reason}`);
        throw new UnauthorizedException('Authentication failed');
      }

      if (!authenticated) {
        throw new UnauthorizedException('Invalid username or password');
      }

      await this.userService.syncActiveDirectoryProfile(user.id, {
        username: userName ?? username,
        displayName,
        phoneNumber,
        emailAddress,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `AD authentication error for ${username}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      const message = this.getUpstreamErrorMessage(error);
      throw new UnauthorizedException(message || 'AD authentication failed');
    }
  }

  private isStaffUser(user: User): boolean {
    return user.roles.some((role) =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
    );
  }

  private getUpstreamErrorMessage(error: unknown): string | null {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
    ) {
      return data.message;
    }

    return error instanceof Error ? error.message : null;
  }
}
