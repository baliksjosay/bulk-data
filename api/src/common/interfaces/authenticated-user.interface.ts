export interface AuthenticatedUser {
  id: string;
  sub: string;
  email: string;
  roles: string[];
  authProvider?: string;
  sessionId?: string;
  refreshToken?: string;
}
