/**
 * Enumerates supported authentication entry methods.
 */
export enum AuthEntryMethod {
  PASSWORD = 'PASSWORD',
  OTP = 'OTP',
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
  REFRESH = 'REFRESH',
  TOTP = 'TOTP',
  WEBAUTHN = 'WEBAUTHN',
  PASSKEY = 'PASSKEY',
  SECURITY_KEY = 'SECURITY_KEY',
}
