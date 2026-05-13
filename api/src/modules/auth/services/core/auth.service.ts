import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import * as crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

import { UserResponseDto } from '../../../users/dto/user-response.dto';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { LoginDto } from '../../dto/login.dto';
import { OtpLoginDto } from '../../dto/otp-login.dto';
import { RefreshTokenDto } from '../../dto/refresh-token.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { LoginAttemptService } from '../security/login-attempt.service';
import { AccountLockService } from '../security/account-lock.service';
import { SecurityEventType } from '../../enums/security-event-type.enum';
import { SecurityContext } from '../../interfaces/security-context.interface';
import { UserService } from 'src/modules/users/services/user.service';
import { UserSessionsService } from 'src/modules/users/services/user-session.service';
import { AuthNotificationService } from './auth-notification.service';
import { AuthPolicyService } from '../security/auth-policy.service';
import { AuthEntryMethod } from '../../enums/auth-entry-method.enum';
import { MfaService } from '../mfa/mfa.service';
import { MfaMethod } from '../../enums/mfa-method.enum';
import { CompleteMfaLoginDto } from '../../dto/complete-mfa-login.dto';
import { StartMfaLoginChallengeDto } from '../../dto/start-mfa-login-challenge.dto';
import { MfaFactorSelectorService } from '../mfa/mfa-factor-selector.service';
import { User } from 'src/modules/users/entities/user.entity';
import { WebauthnAuthenticationService } from '../webauthn/webauthn-authentication.service';
import { MfaRecoveryCodeService } from '../mfa/mfa-recovery-codes.service';
import { LocalActiveDirectoryService } from '../active-directory.service';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { BulkCustomersRepository } from 'src/modules/bulk-data/repositories';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly userSessionsService: UserSessionsService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly loginAttemptService: LoginAttemptService,
    private readonly accountLockService: AccountLockService,
    private readonly authNotificationService: AuthNotificationService,
    private readonly authPolicyService: AuthPolicyService,
    private readonly mfaService: MfaService,
    private readonly mfaFactorSelectorService: MfaFactorSelectorService,
    private readonly webauthnAuthenticationService: WebauthnAuthenticationService,
    private readonly mfaRecoveryCodeService: MfaRecoveryCodeService,
    private readonly activeDirectoryService: LocalActiveDirectoryService,
    private readonly bulkCustomersRepository: BulkCustomersRepository,
  ) {}

  async loginWithPassword(
    dto: LoginDto,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    const identifier = this.getPasswordLoginIdentifier(dto);
    const user = await this.usersService.findByStaffLoginIdentifier(
      identifier,
      true,
    );

    if (!user) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        success: false,
        reason: 'staff_user_not_found',
        authMethod: AuthEntryMethod.PASSWORD,
        metadata: { identifier },
        ...context,
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    if (!this.isStaffUser(user)) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'password_login_not_allowed_for_role',
        authMethod: AuthEntryMethod.PASSWORD,
        metadata: { identifier, roles: user.roles },
        ...context,
      });

      throw new UnauthorizedException(
        'Password login is available only to MTN staff users',
      );
    }

    await this.usersService.ensureUserCanLogin(user);

    const decision = await this.authPolicyService.evaluateLoginPolicy(
      user,
      AuthEntryMethod.PASSWORD,
      context,
    );

    this.authPolicyService.enforceDecision(decision);
    this.authPolicyService.assertEmailVerificationSatisfied(user, decision);
    this.authPolicyService.assertPhoneVerificationSatisfied(user, decision);
    if (decision.recoveryCodePolicy.warning) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_POLICY_WARNING,
        userId: user.id,
        email: user.email,
        success: true,
        reason: decision.recoveryCodePolicy.reason,
        metadata: {
          policyViolation: decision.recoveryCodePolicy.policyViolation,
        },
      });
    }
    if (decision.risk.requiresStepUp) {
      await this.authNotificationService.sendSuspiciousActivityDetected({
        userId: user.id,
        email: user.email,
        reason: 'step_up_required_for_password_login',
        metadata: {
          method: AuthEntryMethod.PASSWORD,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
          riskMetadata: decision.risk.metadata,
        },
      });
    }
    let valid;
    if (user.authProvider === AuthProvider.LOCAL) {
      valid = await bcrypt.compare(dto.password, user.password);
    } else {
      const providerUsername = user.externalId?.trim() || identifier;
      valid = await this.activeDirectoryService.initiateLogin(user, {
        username: providerUsername,
        password: dto.password,
      });
    }

    if (valid === false || valid === undefined || valid === null) {
      const attempts = await this.loginAttemptService.increment(identifier, {
        userId: user.id,
      });

      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'invalid_password',
        metadata: {
          attempts,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
          riskMetadata: decision.risk.metadata,
        },
        ...context,
      });

      await this.usersService.incrementFailedLoginAttempts(user.id);

      if (attempts === 3) {
        await this.authNotificationService.sendFailedLoginWarning({
          userId: user.id,
          email: user.email,
          failedAttempts: attempts,
        });
      }

      if (attempts >= this.loginAttemptService.getBlockThreshold()) {
        const lockedUser = await this.accountLockService.lockUser(
          user.id,
          user.email,
          'too_many_failed_login_attempts',
        );

        await this.authNotificationService.sendAccountLocked({
          userId: lockedUser.id,
          email: lockedUser.email,
          lockedUntil: lockedUser.lockedUntil,
          reason: 'too_many_failed_login_attempts',
        });
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginAttemptService.reset(identifier);
    await this.usersService.recordSuccessfulLogin(user.id);

    if (decision.requiresMfa) {
      return this.createMfaSelectionResponse(user, AuthEntryMethod.PASSWORD, {
        authProvider: user.authProvider,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        deviceId: context.deviceId ?? dto.deviceId,
      });
    }

    const authResult = await this.createAuthenticatedSession(
      user,
      decision.maxActiveSessions,
      context,
      dto.deviceId,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: AuthEntryMethod.PASSWORD,
      authProvider: user.authProvider,
      metadata: {
        sessionId: authResult.sessionId,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        riskMetadata: decision.risk.metadata,
      },
      ...context,
    });

    await this.authPolicyService.recordSuccessfulLoginContext(user.id, context);

    return {
      ...authResult,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async loginWithOtp(
    dto: OtpLoginDto,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    const user = await this.findUserForOtpLogin(dto);

    if (!user) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        success: false,
        reason: 'otp_login_user_not_found',
        authMethod: AuthEntryMethod.OTP,
        metadata: {
          identifier: dto.identifier,
          identifierKind: dto.identifierKind,
        },
        ...context,
      });

      throw new UnauthorizedException('Invalid OTP credentials');
    }

    if (!this.isCustomerOnlyUser(user)) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'otp_login_not_allowed_for_role',
        authMethod: AuthEntryMethod.OTP,
        metadata: {
          identifier: dto.identifier,
          identifierKind: dto.identifierKind,
          roles: user.roles,
        },
        ...context,
      });

      throw new UnauthorizedException(
        'OTP login is available only to customer users',
      );
    }

    await this.usersService.ensureUserCanLogin(user);

    const decision = await this.authPolicyService.evaluateLoginPolicy(
      user,
      AuthEntryMethod.OTP,
      context,
    );

    this.authPolicyService.enforceDecision(decision);
    this.authPolicyService.assertEmailVerificationSatisfied(user, decision);
    this.authPolicyService.assertPhoneVerificationSatisfied(user, decision);

    const expectedOtp = this.getConfiguredOtpLoginCode();
    const otpMatches = expectedOtp && dto.otp.trim() === expectedOtp;

    if (!otpMatches) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: expectedOtp ? 'invalid_otp_code' : 'otp_login_not_configured',
        authMethod: AuthEntryMethod.OTP,
        metadata: {
          identifier: dto.identifier,
          identifierKind: dto.identifierKind,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
        },
        ...context,
      });

      throw new UnauthorizedException('Invalid OTP credentials');
    }

    await this.usersService.recordSuccessfulLogin(user.id);

    const authResult = await this.createAuthenticatedSession(
      user,
      decision.maxActiveSessions,
      context,
      dto.deviceId,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: AuthEntryMethod.OTP,
      authProvider: user.authProvider,
      metadata: {
        sessionId: authResult.sessionId,
        identifier: dto.identifier,
        identifierKind: dto.identifierKind,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        riskMetadata: decision.risk.metadata,
      },
      ...context,
    });

    await this.authPolicyService.recordSuccessfulLoginContext(user.id, context);

    return {
      ...authResult,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async loginWithGoogleOrMicrosoft(
    provider: AuthProvider.GOOGLE | AuthProvider.MICROSOFT,
    verifiedProfile: {
      externalId: string;
      email: string;
      firstName: string;
      lastName: string;
    },
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    let user =
      (await this.usersService.findByExternalIdentity(
        provider,
        verifiedProfile.externalId,
      )) || (await this.usersService.findByEmail(verifiedProfile.email));

    if (!user) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.SOCIAL_LOGIN_FAILED,
        email: verifiedProfile.email,
        success: false,
        authMethod: provider,
        authProvider: provider,
        reason: 'existing_user_required',
        metadata: {
          attemptedExternalId: verifiedProfile.externalId,
        },
        ...context,
      });

      throw new UnauthorizedException(
        'Only existing approved users may sign in with this provider',
      );
    }

    await this.usersService.ensureUserCanLogin(user);

    const entryMethod =
      provider === AuthProvider.GOOGLE
        ? AuthEntryMethod.GOOGLE
        : AuthEntryMethod.MICROSOFT;

    const decision = await this.authPolicyService.evaluateLoginPolicy(
      user,
      entryMethod,
      context,
    );

    this.authPolicyService.enforceDecision(decision);
    this.authPolicyService.assertEmailVerificationSatisfied(user, decision);
    this.authPolicyService.assertPhoneVerificationSatisfied(user, decision);

    if (decision.recoveryCodePolicy.warning) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_POLICY_WARNING,
        userId: user.id,
        email: user.email,
        success: true,
        reason: decision.recoveryCodePolicy.reason,
        metadata: {
          policyViolation: decision.recoveryCodePolicy.policyViolation,
        },
      });
    }

    if (decision.risk.requiresStepUp) {
      await this.authNotificationService.sendSuspiciousActivityDetected({
        userId: user.id,
        email: user.email,
        reason: 'step_up_required_for_social_login',
        metadata: {
          provider,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
          riskMetadata: decision.risk.metadata,
        },
      });
    }

    if (
      user.externalId &&
      user.authProvider === provider &&
      user.externalId !== verifiedProfile.externalId
    ) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.SOCIAL_LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        authMethod: provider,
        authProvider: provider,
        reason: 'identity_mismatch',
        metadata: {
          attemptedExternalId: verifiedProfile.externalId,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
          riskMetadata: decision.risk.metadata,
        },
        ...context,
      });

      await this.authNotificationService.sendSuspiciousActivityDetected({
        userId: user.id,
        email: user.email,
        reason: 'social_identity_mismatch',
        metadata: {
          provider,
          attemptedExternalId: verifiedProfile.externalId,
        },
      });

      throw new UnauthorizedException('Identity mismatch');
    }

    if (!user.externalId) {
      user = await this.usersService.attachSocialIdentity(
        user.id,
        provider,
        verifiedProfile.externalId,
      );
    }

    if (decision.requiresMfa) {
      return this.createMfaSelectionResponse(user, entryMethod, {
        authProvider: provider,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        deviceId: context.deviceId,
      });
    }

    const authResult = await this.createAuthenticatedSession(
      user,
      decision.maxActiveSessions,
      context,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.SOCIAL_LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: entryMethod,
      authProvider: provider,
      metadata: {
        sessionId: authResult.sessionId,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        riskMetadata: decision.risk.metadata,
      },
      ...context,
    });

    await this.authPolicyService.recordSuccessfulLoginContext(user.id, context);

    return {
      ...authResult,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async loginWithWebauthn(input: {
    assertion: Record<string, unknown>;
    context: SecurityContext;
  }): Promise<AuthResponseDto> {
    const verification =
      await this.webauthnAuthenticationService.finishAuthentication({
        assertion: input.assertion,
      });

    if (!verification.success || !verification.userId) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.PASSKEY_LOGIN_FAILED,
        success: false,
        reason: verification.reason ?? 'webauthn_login_failed',
        metadata: {
          credentialId: verification.credentialId,
        },
        ...input.context,
      });

      throw new UnauthorizedException(
        verification.reason ?? 'WebAuthn authentication failed',
      );
    }

    const user = await this.usersService.requireById(verification.userId);
    await this.usersService.ensureUserCanLogin(user);

    const decision = await this.authPolicyService.evaluateLoginPolicy(
      user,
      AuthEntryMethod.WEBAUTHN,
      input.context,
    );

    this.authPolicyService.enforceDecision(decision);
    this.authPolicyService.assertEmailVerificationSatisfied(user, decision);
    this.authPolicyService.assertPhoneVerificationSatisfied(user, decision);

    if (decision.recoveryCodePolicy.warning) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_POLICY_WARNING,
        userId: user.id,
        email: user.email,
        success: true,
        reason: decision.recoveryCodePolicy.reason,
        metadata: {
          policyViolation: decision.recoveryCodePolicy.policyViolation,
        },
      });
    }
    const authResult = await this.createAuthenticatedSession(
      user,
      decision.maxActiveSessions,
      input.context,
      input.context.deviceId ?? undefined,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.PASSKEY_LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: AuthEntryMethod.WEBAUTHN,
      authProvider: user.authProvider,
      metadata: {
        sessionId: authResult.sessionId,
        credentialId: verification.credentialId,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        riskMetadata: decision.risk.metadata,
      },
      ...input.context,
    });

    await this.authPolicyService.recordSuccessfulLoginContext(
      user.id,
      input.context,
    );

    return {
      ...authResult,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async startMfaLoginChallenge(
    dto: StartMfaLoginChallengeDto,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    const selectionPayload = this.tokenService.verifyMfaSelectionToken(
      dto.selectionToken,
    );

    if (!selectionPayload.sub) {
      throw new UnauthorizedException('Invalid MFA selection token payload');
    }

    const user = await this.usersService.requireById(selectionPayload.sub);
    await this.usersService.ensureUserCanLogin(user);

    const entryMethod = selectionPayload.entryMethod as AuthEntryMethod;
    const originalProvider = selectionPayload.originalAuthProvider as
      | AuthProvider
      | undefined;
    const requestedMethod = dto.mfaMethod;
    const availableMethods = await this.getAvailableLoginMfaMethods(user);

    if (!availableMethods.includes(requestedMethod)) {
      throw new UnauthorizedException('Requested MFA method is not available');
    }

    const mfaChallenge =
      requestedMethod === MfaMethod.RECOVERY_CODE
        ? null
        : await this.mfaService.createChallenge(requestedMethod, user.id, {
            method: entryMethod,
            riskScore: Number(selectionPayload.riskScore ?? 0),
            selectedByUser: true,
          });
    const challengeId = mfaChallenge?.challengeId ?? crypto.randomUUID();

    const challengeToken = this.tokenService.generateMfaChallengeToken({
      user,
      entryMethod,
      authProvider: originalProvider ?? user.authProvider,
      riskScore: Number(selectionPayload.riskScore ?? 0),
      challengeId,
      deviceId: context.deviceId ?? dto.deviceId ?? selectionPayload.deviceId,
      mfaMethod: requestedMethod,
    });

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_CHALLENGE_STARTED,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: entryMethod,
      authProvider: originalProvider ?? user.authProvider,
      metadata: {
        challengeId,
        method: requestedMethod,
        availableMethods,
        selectedByUser: true,
        riskScore: Number(selectionPayload.riskScore ?? 0),
      },
      ...context,
    });

    return {
      mfaRequired: true,
      challengeToken,
      challengeId,
      mfaMethod: requestedMethod,
      availableMfaMethods: availableMethods,
      mfaChallengeMetadata: mfaChallenge?.metadata,
      preferredMfaMethod:
        this.getPreferredMethodFromAvailable(availableMethods),
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  /**
   * Completes login after MFA challenge verification.
   *
   * Supports:
   * - TOTP
   * - SMS OTP
   * - Email OTP
   * - WebAuthn
   * - Recovery codes
   */
  async completeMfaLogin(
    dto: CompleteMfaLoginDto,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    const challengePayload = this.tokenService.verifyMfaChallengeToken(
      dto.challengeToken,
    );

    if (!challengePayload.sub) {
      throw new UnauthorizedException('Invalid MFA challenge token payload');
    }

    if (challengePayload.challengeId !== dto.challengeId) {
      throw new BadRequestException(
        'Challenge token does not match challenge id',
      );
    }

    const user = await this.usersService.requireById(challengePayload.sub);
    await this.usersService.ensureUserCanLogin(user);

    const entryMethod = challengePayload.entryMethod as AuthEntryMethod;
    const originalProvider = challengePayload.originalAuthProvider as
      | AuthProvider
      | undefined;
    const mfaMethod = challengePayload.mfaMethod as MfaMethod | undefined;

    if (!mfaMethod) {
      throw new BadRequestException('Missing MFA method in challenge token');
    }

    let verification: { success: boolean; reason?: string };

    if (mfaMethod === MfaMethod.RECOVERY_CODE) {
      if (!dto?.recoveryCode || !dto?.recoveryCode?.trim()) {
        throw new BadRequestException(
          'Recovery code is required for recovery-code MFA',
        );
      }

      const valid = await this.mfaRecoveryCodeService.verifyAndConsume(
        user.id,
        dto.recoveryCode.trim(),
        context,
        'mfa_login_recovery',
        user.email,
      );

      verification = valid
        ? { success: true }
        : { success: false, reason: 'invalid_recovery_code' };
    } else {
      const requiresEnrolledFactor = ![
        MfaMethod.EMAIL_OTP,
        MfaMethod.SMS_OTP,
      ].includes(mfaMethod);

      if (requiresEnrolledFactor) {
        const isEnabled = await this.mfaFactorSelectorService.isMethodEnabled(
          user.id,
          mfaMethod,
        );

        if (!isEnabled) {
          throw new UnauthorizedException(
            'Requested MFA method is not enabled',
          );
        }
      }

      const verificationPayload =
        mfaMethod === MfaMethod.WEBAUTHN
          ? { assertion: dto.assertion }
          : { code: dto.code };

      if (
        mfaMethod === MfaMethod.WEBAUTHN &&
        (!dto.assertion || typeof dto.assertion !== 'object')
      ) {
        throw new BadRequestException(
          'WebAuthn assertion is required for WebAuthn MFA',
        );
      }

      if (mfaMethod !== MfaMethod.WEBAUTHN && (!dto.code || !dto.code.trim())) {
        throw new BadRequestException(
          'Verification code is required for OTP-based MFA',
        );
      }

      verification = await this.mfaService.verifyChallenge(
        mfaMethod,
        user.id,
        dto.challengeId,
        verificationPayload,
      );
    }

    if (!verification.success) {
      await this.securityAuditService.log({
        eventType:
          mfaMethod === MfaMethod.RECOVERY_CODE
            ? SecurityEventType.MFA_RECOVERY_CODE_FAILED
            : SecurityEventType.MFA_CHALLENGE_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        authMethod: entryMethod,
        authProvider: originalProvider ?? user.authProvider,
        reason: verification.reason ?? 'mfa_verification_failed',
        metadata: {
          challengeId: dto.challengeId,
          mfaMethod,
        },
        ...context,
      });

      throw new UnauthorizedException(
        verification.reason ?? 'MFA verification failed',
      );
    }

    const decision = await this.authPolicyService.evaluateLoginPolicy(
      user,
      entryMethod,
      context,
    );
    if (decision.recoveryCodePolicy.warning) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.MFA_RECOVERY_CODE_POLICY_WARNING,
        userId: user.id,
        email: user.email,
        success: true,
        reason: decision.recoveryCodePolicy.reason,
        metadata: {
          policyViolation: decision.recoveryCodePolicy.policyViolation,
        },
      });
    }

    const authResult = await this.createAuthenticatedSession(
      user,
      decision.maxActiveSessions,
      context,
      dto.deviceId ?? challengePayload.deviceId,
    );

    await this.securityAuditService.log({
      eventType:
        mfaMethod === MfaMethod.RECOVERY_CODE
          ? SecurityEventType.MFA_RECOVERY_CODE_USED
          : SecurityEventType.MFA_CHALLENGE_PASSED,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: entryMethod,
      authProvider: originalProvider ?? user.authProvider,
      metadata: {
        challengeId: dto.challengeId,
        mfaMethod,
        sessionId: authResult.sessionId,
      },
      ...context,
    });

    await this.securityAuditService.log({
      eventType:
        entryMethod === AuthEntryMethod.PASSWORD
          ? SecurityEventType.LOGIN_SUCCESS
          : SecurityEventType.SOCIAL_LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: entryMethod,
      authProvider: originalProvider ?? user.authProvider,
      metadata: {
        sessionId: authResult.sessionId,
        completedViaMfa: true,
        mfaMethod,
      },
      ...context,
    });

    if (mfaMethod === MfaMethod.RECOVERY_CODE) {
      await this.authNotificationService.sendSuspiciousActivityDetected({
        userId: user.id,
        email: user.email,
        reason: 'mfa_recovery_code_used',
        metadata: {
          sessionId: authResult.sessionId,
          entryMethod,
        },
      });
    }

    await this.authPolicyService.recordSuccessfulLoginContext(user.id, context);

    return {
      ...authResult,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async refresh(
    userId: string,
    dto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    const session = await this.userSessionsService.validateRefreshToken(
      userId,
      dto.refreshToken,
    );

    const user = await this.usersService.requireById(session.userId);
    await this.usersService.ensureUserCanLogin(user);

    const newRefreshToken = this.tokenService.generateRefreshToken(
      user,
      session.id,
    );
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.userSessionsService.rotateRefreshToken(
      session.id,
      newRefreshToken,
      newExpiresAt,
    );

    const accessToken = this.tokenService.generateAccessToken(user, session.id);

    await this.securityAuditService.log({
      eventType: SecurityEventType.REFRESH_TOKEN_USED,
      userId: user.id,
      email: user.email,
      success: true,
      metadata: { sessionId: session.id },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: session.id,
      mfaRequired: false,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    await this.userSessionsService.revokeSession(sessionId, 'logout');

    const user = await this.usersService.requireById(userId);

    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGOUT,
      userId,
      email: user.email,
      success: true,
      metadata: { sessionId },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.userSessionsService.revokeAllUserSessions(userId, 'logout_all');

    const user = await this.usersService.requireById(userId);

    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGOUT_ALL,
      userId,
      email: user.email,
      success: true,
    });
  }

  private async findUserForOtpLogin(dto: OtpLoginDto): Promise<User | null> {
    const identifier = dto.identifier.trim();
    const normalizedEmail = identifier.toLowerCase();

    if (dto.identifierKind === 'email' || normalizedEmail.includes('@')) {
      return this.usersService.findByEmail(normalizedEmail);
    }

    if (dto.identifierKind === 'tin') {
      return this.findCustomerUserByTin(identifier);
    }

    if (dto.identifierKind === 'phone' || /^[+\d\s()-]+$/.test(identifier)) {
      const user = await this.usersService.findByPhoneNumber(
        this.normalizeOtpPhoneIdentifier(identifier),
      );

      if (user) {
        return user;
      }

      if (dto.identifierKind === 'phone') {
        return null;
      }
    }

    return this.looksLikeTin(identifier)
      ? this.findCustomerUserByTin(identifier)
      : null;
  }

  private async findCustomerUserByTin(
    identifier: string,
  ): Promise<User | null> {
    const customer =
      await this.bulkCustomersRepository.findByRegistrationNumber(
        this.normalizeTinIdentifier(identifier),
      );

    if (!customer) {
      return null;
    }

    const email = customer.email?.trim().toLowerCase();
    if (email) {
      const user = await this.usersService.findByEmail(email);
      if (user) {
        return user;
      }
    }

    const phone = customer.phone?.trim() || customer.businessPhone?.trim();
    if (phone) {
      return this.usersService.findByPhoneNumber(
        this.normalizeOtpPhoneIdentifier(phone),
      );
    }

    return null;
  }

  private normalizeTinIdentifier(identifier: string): string {
    return identifier.trim().replace(/\s+/g, '');
  }

  private looksLikeTin(identifier: string): boolean {
    const trimmed = identifier.trim();
    const tinDigits = trimmed.replace(/\D/g, '');

    return (
      tinDigits.length === 10 || /^[a-z0-9][a-z0-9._/-]{3,}$/i.test(trimmed)
    );
  }

  private normalizeOtpPhoneIdentifier(identifier: string): string {
    const trimmed = identifier.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (trimmed.startsWith('+')) {
      return `+${digits}`;
    }

    if (digits.length === 10 && digits.startsWith('0')) {
      return `+256${digits.slice(1)}`;
    }

    if (digits.length === 12 && digits.startsWith('256')) {
      return `+${digits}`;
    }

    return trimmed;
  }

  private getConfiguredOtpLoginCode(): string | null {
    const configured =
      process.env.DEMO_LOGIN_OTP ?? process.env.AUTH_OTP_LOGIN_CODE;
    const code =
      configured?.trim() ||
      (process.env.SEED_DEMO_USERS === 'true' ? '123456' : '');

    return /^\d{5}$/.test(code) ? code : null;
  }

  private getPasswordLoginIdentifier(dto: LoginDto): string {
    const identifier = (dto.username ?? dto.email ?? dto.phoneNumber ?? '')
      .trim()
      .toLowerCase();

    if (!identifier) {
      throw new BadRequestException(
        'Username, email, or phone number is required',
      );
    }

    return identifier;
  }

  private isStaffUser(user: User): boolean {
    return user.roles.some((role) =>
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
    );
  }

  private isCustomerOnlyUser(user: User): boolean {
    return (
      user.roles.includes(UserRole.CUSTOMER) &&
      !user.roles.some((role) =>
        [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role),
      )
    );
  }

  private async createMfaSelectionResponse(
    user: User,
    entryMethod: AuthEntryMethod,
    options: {
      authProvider?: AuthProvider;
      riskScore: number;
      riskReasons: string[];
      deviceId?: string;
    },
  ): Promise<AuthResponseDto> {
    const availableMfaMethods = await this.getAvailableLoginMfaMethods(user);

    if (!availableMfaMethods.length) {
      throw new BadRequestException('No MFA methods are available');
    }

    const preferredMfaMethod =
      this.getPreferredMethodFromAvailable(availableMfaMethods);
    const mfaSelectionToken = this.tokenService.generateMfaSelectionToken({
      user,
      entryMethod,
      authProvider: options.authProvider ?? user.authProvider,
      riskScore: options.riskScore,
      deviceId: options.deviceId,
    });

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_CHALLENGE_STARTED,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: entryMethod,
      authProvider: options.authProvider ?? user.authProvider,
      metadata: {
        challengePendingUserSelection: true,
        availableMethods: availableMfaMethods,
        preferredMethod: preferredMfaMethod,
        riskScore: options.riskScore,
        riskReasons: options.riskReasons,
      },
    });

    return {
      mfaRequired: true,
      mfaSelectionToken,
      availableMfaMethods,
      preferredMfaMethod,
      mfaMethod: preferredMfaMethod,
      user: plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    };
  }

  private async getAvailableLoginMfaMethods(user: User): Promise<MfaMethod[]> {
    const enrolledMethods =
      await this.mfaFactorSelectorService.getEnabledMethods(user.id);
    const methods: MfaMethod[] = [];

    if (user.email) {
      methods.push(MfaMethod.EMAIL_OTP);
    }

    if (user.phoneNumber) {
      methods.push(MfaMethod.SMS_OTP);
    }

    for (const method of enrolledMethods) {
      if (
        method === MfaMethod.TOTP ||
        method === MfaMethod.WEBAUTHN ||
        method === MfaMethod.EMAIL_OTP ||
        method === MfaMethod.SMS_OTP
      ) {
        methods.push(method);
      }
    }

    if (await this.mfaRecoveryCodeService.hasActiveBatch(user.id)) {
      methods.push(MfaMethod.RECOVERY_CODE);
    }

    return [...new Set(methods)];
  }

  private getPreferredMethodFromAvailable(methods: MfaMethod[]): MfaMethod {
    return methods.includes(MfaMethod.EMAIL_OTP)
      ? MfaMethod.EMAIL_OTP
      : methods[0];
  }

  /**
   * Creates a final authenticated session and returns issued tokens.
   */
  private async createAuthenticatedSession(
    user: User,
    maxActiveSessions: number,
    context: SecurityContext,
    deviceId?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    const activeSessions = await this.userSessionsService.listActiveSessions(
      user.id,
    );

    if (activeSessions.length >= maxActiveSessions) {
      const sorted = [...activeSessions].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const extra = activeSessions.length - (maxActiveSessions - 1);

      for (const session of sorted.slice(0, extra)) {
        await this.userSessionsService.revokeSession(
          session.id,
          'maximum_device_limit_exceeded',
        );
      }
    }

    const provisionalRefreshToken = this.tokenService.generateRefreshToken(
      user,
      crypto.randomUUID(),
    );

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await this.userSessionsService.createSession({
      userId: user.id,
      refreshToken: provisionalRefreshToken,
      expiresAt,
      ipAddress: context.ipAddress ?? undefined,
      userAgent: context.userAgent ?? undefined,
      deviceId: context.deviceId ?? deviceId,
      deviceType: context.deviceType ?? undefined,
      browser: context.browser ?? undefined,
      os: context.os ?? undefined,
    });

    const accessToken = this.tokenService.generateAccessToken(user, session.id);
    const refreshToken = this.tokenService.generateRefreshToken(
      user,
      session.id,
    );

    await this.userSessionsService.rotateRefreshToken(
      session.id,
      refreshToken,
      expiresAt,
    );

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }
}
