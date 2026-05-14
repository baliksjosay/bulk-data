import { User } from 'src/modules/users/entities/user.entity';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { AuthService } from './auth.service';

jest.mock('../mfa/mfa.service', () => ({
  MfaService: class MockMfaService {},
}));

type PasswordLoginIdentifierKind = 'email' | 'phone' | 'tin' | 'username';

type AuthServicePasswordPolicy = {
  canUsePasswordLogin(
    user: User,
    identifierKind: PasswordLoginIdentifierKind,
  ): boolean;
};

function makeUser(params: Pick<User, 'authProvider' | 'roles'>): User {
  return {
    id: 'user-id',
    email: 'user@example.com',
    authProvider: params.authProvider,
    roles: params.roles,
  } as User;
}

describe('AuthService password login policy', () => {
  const service = Object.create(
    AuthService.prototype,
  ) as AuthServicePasswordPolicy;

  it('requires staff users to sign in with username / LAN ID', () => {
    const staffUser = makeUser({
      authProvider: AuthProvider.AD,
      roles: [UserRole.ADMIN],
    });

    expect(service.canUsePasswordLogin(staffUser, 'username')).toBe(true);
    expect(service.canUsePasswordLogin(staffUser, 'email')).toBe(false);
    expect(service.canUsePasswordLogin(staffUser, 'phone')).toBe(false);
    expect(service.canUsePasswordLogin(staffUser, 'tin')).toBe(false);
  });

  it('keeps customer password login on TIN, phone, or email only', () => {
    const customerUser = makeUser({
      authProvider: AuthProvider.LOCAL,
      roles: [UserRole.CUSTOMER],
    });

    expect(service.canUsePasswordLogin(customerUser, 'email')).toBe(true);
    expect(service.canUsePasswordLogin(customerUser, 'phone')).toBe(true);
    expect(service.canUsePasswordLogin(customerUser, 'tin')).toBe(true);
    expect(service.canUsePasswordLogin(customerUser, 'username')).toBe(false);
  });
});
