import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

import { User } from 'src/modules/users/entities/user.entity';
import { AuthProvider } from 'src/modules/users/enums/auth-provider.enum';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { LocalActiveDirectoryService } from './active-directory.service';

describe('LocalActiveDirectoryService', () => {
  const staffUser = {
    id: 'user-1',
    email: 'admin@example.com',
    roles: [UserRole.ADMIN],
    authProvider: AuthProvider.AD,
  } as User;

  const createService = (configValues: Record<string, unknown> = {}) => {
    const httpService = {
      post: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const userService = {
      syncActiveDirectoryProfile: jest.fn(),
    };

    const service = new LocalActiveDirectoryService(
      httpService as unknown as HttpService,
      configService as unknown as ConfigService,
      userService as unknown as UserService,
    );

    return { service, httpService, configService, userService };
  };

  it('authenticates against the configured directory endpoint and syncs returned profile details', async () => {
    const { service, httpService, userService } = createService({
      LDAP_API_SERVICE: 'http://directory.example.test/ldap-auth',
    });
    const syncedUser = {
      ...staffUser,
      externalId: 'jdoe',
      phoneNumber: '+256789172796',
    } as User;

    httpService.post.mockReturnValue(
      of({
        data: {
          authenticated: true,
          userName: 'jdoe',
          displayName: 'Joseph Doe',
          phoneNumber: '+256789172796',
          emailAddress: 'joseph.doe@example.com',
        },
      }),
    );
    userService.syncActiveDirectoryProfile.mockResolvedValue(syncedUser);

    await expect(
      service.initiateLogin(staffUser, {
        username: 'admin@example.com',
        password: 'secret-password',
      }),
    ).resolves.toBe(syncedUser);

    expect(httpService.post).toHaveBeenCalledWith(
      'http://directory.example.test/ldap-auth',
      {
        username: 'admin@example.com',
        password: 'secret-password',
      },
      { timeout: 60000 },
    );
    expect(userService.syncActiveDirectoryProfile).toHaveBeenCalledWith(
      staffUser.id,
      {
        username: 'jdoe',
        displayName: 'Joseph Doe',
        phoneNumber: '+256789172796',
        emailAddress: 'joseph.doe@example.com',
      },
    );
  });

  it('normalizes alternate MTN AD response fields before syncing the staff profile', async () => {
    const { service, httpService, userService } = createService({
      MTNAD_LOGIN_URL: 'http://directory.example.test/auth/user',
    });
    const syncedUser = {
      ...staffUser,
      externalId: 'jdoe',
      phoneNumber: '+256771234567',
    } as User;

    httpService.post.mockReturnValue(
      of({
        data: {
          data: {
            authenticated: 'yes',
            samAccountName: 'JDoe',
            givenName: 'Joseph',
            sn: 'Doe',
            mobile: '0771234567',
            mail: 'JOSEPH.DOE@EXAMPLE.COM',
          },
        },
      }),
    );
    userService.syncActiveDirectoryProfile.mockResolvedValue(syncedUser);

    await expect(
      service.initiateLogin(staffUser, {
        username: 'jdoe',
        password: 'secret-password',
      }),
    ).resolves.toBe(syncedUser);

    expect(userService.syncActiveDirectoryProfile).toHaveBeenCalledWith(
      staffUser.id,
      {
        username: 'jdoe',
        displayName: 'Joseph Doe',
        firstName: 'Joseph',
        lastName: 'Doe',
        phoneNumber: '0771234567',
        emailAddress: 'joseph.doe@example.com',
      },
    );
  });

  it('rejects non-staff users before calling the directory provider', async () => {
    const { service, httpService } = createService({
      MTNAD_LOGIN_URL: 'http://directory.example.test/auth/user',
    });
    const customerUser = {
      ...staffUser,
      roles: [UserRole.CUSTOMER],
    } as User;

    await expect(
      service.initiateLogin(customerUser, {
        username: 'customer@example.com',
        password: 'secret-password',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated directory responses without syncing profile data', async () => {
    const { service, httpService, userService } = createService({
      MTNAD_LOGIN_URL: 'http://directory.example.test/auth/user',
    });

    httpService.post.mockReturnValue(
      of({
        data: {
          authenticated: false,
        },
      }),
    );

    await expect(
      service.initiateLogin(staffUser, {
        username: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(userService.syncActiveDirectoryProfile).not.toHaveBeenCalled();
  });

  it('treats directory system failures as unavailable instead of bad credentials', async () => {
    const { service, httpService, userService } = createService({
      MTNAD_LOGIN_URL: 'http://directory.example.test/auth/user',
    });

    httpService.post.mockReturnValue(
      of({
        data: {
          authenticated: false,
          authSystemError: 'upstream unavailable',
        },
      }),
    );

    await expect(
      service.initiateLogin(staffUser, {
        username: 'admin@example.com',
        password: 'secret-password',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(userService.syncActiveDirectoryProfile).not.toHaveBeenCalled();
  });

  it('preserves profile sync conflicts instead of reporting AD as unavailable', async () => {
    const { service, httpService, userService } = createService({
      MTNAD_LOGIN_URL: 'http://directory.example.test/auth/user',
    });

    httpService.post.mockReturnValue(
      of({
        data: {
          authenticated: true,
          userName: 'jdoe',
          emailAddress: 'joseph.doe@example.com',
        },
      }),
    );
    userService.syncActiveDirectoryProfile.mockRejectedValue(
      new ConflictException(
        'Active Directory username is already linked to another user',
      ),
    );

    await expect(
      service.initiateLogin(staffUser, {
        username: 'jdoe',
        password: 'secret-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
