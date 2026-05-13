import { AuthProvider } from '../enums/auth-provider.enum';

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  authProvider?: AuthProvider;
  sessionId?: string;
  type?: 'access' | 'refresh' | 'mfa_challenge' | 'mfa_selection';
}
