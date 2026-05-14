import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '../users/users.module';
import { BulkCustomerEntity } from '../bulk-data/entities';
import { BulkCustomersRepository } from '../bulk-data/repositories';

import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { WebauthnController } from './controllers/webauthn.controller';
import { SecurityController } from './controllers/security.controller';

import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PhoneVerificationOtp } from './entities/phone-verification-otp.entity';
import { AuthChallenge } from './entities/auth-challenge.entity';
import { UserAuthFactor } from './entities/user-auth-factor.entity';
import { WebauthnCredential } from './entities/webauthn-credential.entity';
import { MfaRecoveryCode } from './entities/mfa-recovery-code.entity';
import { SecurityAuditLog } from './entities/security-audit-log.entity';

import { AuthService } from './services/core/auth.service';
import { TokenService } from './services/core/token.service';
import { PasswordService } from './services/core/password.service';
import { ActivationService } from './services/core/activation.service';
import { PasswordResetService } from './services/core/password-reset.service';
import { EmailVerificationService } from './services/core/email-verification.service';
import { PhoneVerificationService } from './services/core/phone-verification.service';

import { SecurityAuditService } from './services/security/security-audit.service';
import { LoginAttemptService } from './services/security/login-attempt.service';
import { AccountLockService } from './services/security/account-lock.service';
import { AuthPolicyService } from './services/security/auth-policy.service';

import { MfaService } from './services/mfa/mfa.service';
import { TotpMfaProvider } from './services/mfa/providers/totp-mfa.provider';

import { WebauthnRegistrationService } from './services/webauthn/webauthn-registration.service';
import { WebauthnAuthenticationService } from './services/webauthn/webauthn-authentication.service';

import { JwtStrategy } from './strategies/jwt.strategy';
import { UnlockAccountsJob } from './jobs/unlock-accounts.job';
import { CleanupAuthArtifactsJob } from './jobs/cleanup-auth-artifacts.job';
import { MfaFactorSelectorService } from './services/mfa/mfa-factor-selector.service';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { EmailOtpMfaProvider } from './services/mfa/providers/email-otp-mfa.provider';
import { SmsOtpMfaProvider } from './services/mfa/providers/sms-otp-mfa.provider';
import { WebauthnMfaProvider } from './services/mfa/providers/webauthn-mfa.provider';
import { MfaRecoveryCodeBatch } from './entities/mfa-recovery-code-batches.entity';
import { AuthNotificationService } from './services/core/auth-notification.service';
import { MfaRecoveryCodeService } from './services/mfa/mfa-recovery-codes.service';
import { GoogleTokenVerifierService } from './services/social/google-token-verifier.service';
import { MicrosoftTokenVerifierService } from './services/social/microsoft-token-verifier.service';
import { TotpSetupService } from './services/mfa/totp-setup.service';
import { LocalActiveDirectoryService } from './services/active-directory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PasswordResetToken,
      EmailVerificationToken,
      PhoneVerificationOtp,
      AuthChallenge,
      UserAuthFactor,
      WebauthnCredential,
      MfaRecoveryCode,
      MfaRecoveryCodeBatch,
      SecurityAuditLog,
      BulkCustomerEntity,
    ]),
    UserModule,
  ],
  controllers: [
    AuthController,
    MfaController,
    WebauthnController,
    SecurityController,
  ],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    ActivationService,
    PasswordResetService,
    EmailVerificationService,
    PhoneVerificationService,

    SecurityAuditService,
    LoginAttemptService,
    AccountLockService,
    AuthPolicyService,

    MfaService,
    TotpMfaProvider,
    EmailOtpMfaProvider,
    SmsOtpMfaProvider,
    WebauthnMfaProvider,
    MfaFactorSelectorService,
    MfaRecoveryCodeService,
    GoogleTokenVerifierService,
    MicrosoftTokenVerifierService,
    TotpSetupService,
    LocalActiveDirectoryService,
    BulkCustomersRepository,

    WebauthnRegistrationService,
    WebauthnAuthenticationService,

    JwtStrategy,
    RefreshTokenStrategy,

    UnlockAccountsJob,
    CleanupAuthArtifactsJob,

    AuthNotificationService,
  ],
  exports: [
    AuthService,
    TokenService,
    MfaService,
    SecurityAuditService,
    ActivationService,
  ],
})
export class AuthModule {}
