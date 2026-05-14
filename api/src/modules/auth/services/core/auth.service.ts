import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import * as crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { UserResponseDto } from '../../../users/dto/user-response.dto';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { LoginDto } from '../../dto/login.dto';
import { OtpLoginDto } from '../../dto/otp-login.dto';
import {
  RequestOtpLoginDto,
  RequestOtpLoginResponseDto,
} from '../../dto/request-otp-login.dto';
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
import {
  ActiveDirectoryAuthenticatedProfile,
  LocalActiveDirectoryService,
} from '../active-directory.service';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { BulkCustomersRepository } from 'src/modules/bulk-data/repositories';
import { AuthChallenge } from '../../entities/auth-challenge.entity';
import { AuthChallengeType } from '../../enums/auth-challenge-type.enum';

type CustomerOtpDelivery = {
  deliveryChannel: 'sms' | 'email';
  destination: string;
  maskedDestination: string;
};

type PasswordLoginIdentifierKind = 'email' | 'phone' | 'tin' | 'username';

type PasswordLoginIdentity = {
  identifier: string;
  identifierKind: PasswordLoginIdentifierKind;
  user: User | null;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthChallenge)
    private readonly authChallengeRepo: Repository<AuthChallenge>,
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
    private readonly configService: ConfigService,
  ) {}

  async loginWithPassword(
    dto: LoginDto,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    const identifier = this.getPasswordLoginIdentifier(dto);
    const identity = await this.findUserForPasswordLoginIdentifier(identifier);
    let user = identity.user;
    let directoryAuthenticatedUser: User | null = null;

    if (!user && identity.identifierKind === 'username') {
      directoryAuthenticatedUser =
        await this.resolveUnlinkedActiveDirectoryStaffLogin(
          identity.identifier,
          dto.password,
        );
      user = directoryAuthenticatedUser;
    }

    if (!user) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        success: false,
        reason: 'password_user_not_found',
        authMethod: AuthEntryMethod.PASSWORD,
        metadata: { identifierKind: identity.identifierKind },
        ...context,
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    if (!this.canUsePasswordLogin(user, identity.identifierKind)) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'password_login_not_allowed_for_identifier',
        authMethod: AuthEntryMethod.PASSWORD,
        metadata: {
          identifierKind: identity.identifierKind,
          roles: user.roles,
          authProvider: user.authProvider,
        },
        ...context,
      });

      throw new UnauthorizedException('Invalid username or password');
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
    let authenticatedUser = directoryAuthenticatedUser ?? user;
    let valid = Boolean(directoryAuthenticatedUser);
    if (user.authProvider === AuthProvider.LOCAL) {
      valid = user.password
        ? await bcrypt.compare(dto.password, user.password)
        : false;
    } else if (user.authProvider === AuthProvider.AD && !valid) {
      const providerUsername = user.externalId?.trim() || identity.identifier;
      try {
        authenticatedUser = await this.activeDirectoryService.initiateLogin(
          user,
          {
            username: providerUsername,
            password: dto.password,
          },
        );
        valid = true;
      } catch (error) {
        if (!(error instanceof UnauthorizedException)) {
          throw error;
        }
        valid = false;
      }
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
      return this.createMfaSelectionResponse(
        authenticatedUser,
        AuthEntryMethod.PASSWORD,
        {
          authProvider: authenticatedUser.authProvider,
          riskScore: decision.risk.score,
          riskReasons: decision.risk.reasons,
          deviceId: context.deviceId ?? dto.deviceId,
        },
      );
    }

    const authResult = await this.createAuthenticatedSession(
      authenticatedUser,
      decision.maxActiveSessions,
      context,
      dto.deviceId,
    );

    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      success: true,
      authMethod: AuthEntryMethod.PASSWORD,
      authProvider: authenticatedUser.authProvider,
      metadata: {
        sessionId: authResult.sessionId,
        riskScore: decision.risk.score,
        riskReasons: decision.risk.reasons,
        riskMetadata: decision.risk.metadata,
      },
      ...context,
    });

    await this.authPolicyService.recordSuccessfulLoginContext(user.id, context);

    return this.createSuccessfulLoginResponse(
      authResult,
      authenticatedUser,
      AuthEntryMethod.PASSWORD,
    );
  }

  async requestOtpLogin(
    dto: RequestOtpLoginDto,
    context: SecurityContext,
  ): Promise<RequestOtpLoginResponseDto> {
    const user = await this.findUserForOtpRequest(dto);
    const acceptedResponse: RequestOtpLoginResponseDto = {
      accepted: true,
      retryAfterSeconds: 60,
    };

    if (!user || !this.isCustomerOnlyUser(user)) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        success: false,
        reason: user
          ? 'otp_request_not_allowed_for_role'
          : 'otp_request_user_not_found',
        authMethod: AuthEntryMethod.OTP,
        metadata: {
          identifier: dto.identifier,
          identifierKind: dto.identifierKind,
        },
        ...context,
      });

      return acceptedResponse;
    }

    await this.usersService.ensureUserCanLogin(user);

    const delivery = this.resolveCustomerOtpDelivery(user, dto);

    if (!delivery) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'otp_request_delivery_channel_unavailable',
        authMethod: AuthEntryMethod.OTP,
        metadata: {
          identifier: dto.identifier,
          identifierKind: dto.identifierKind,
          requestedDeliveryChannel: dto.deliveryChannel,
        },
        ...context,
      });

      return acceptedResponse;
    }

    const otp = this.generateNumericOtp(5);
    const otpHash = await this.passwordService.hash(otp);
    const expirySeconds = this.configService.get<number>(
      'otp.expirySeconds',
      180,
    );
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);
    const challenge = this.authChallengeRepo.create({
      userId: user.id,
      type: AuthChallengeType.MFA,
      challenge: crypto.randomUUID(),
      expiresAt,
      isUsed: false,
      payload: {
        purpose: 'customer_login_otp',
        otpHash,
        identifier: dto.identifier,
        identifierKind: dto.identifierKind,
        deliveryChannel: delivery.deliveryChannel,
      },
    });
    const saved = await this.authChallengeRepo.save(challenge);

    await this.authNotificationService.sendCustomerLoginOtpRequested({
      userId: user.id,
      challengeId: saved.id,
      deliveryChannel: delivery.deliveryChannel,
      destination: delivery.destination,
      otp,
      expiresAt,
    });

    await this.securityAuditService.log({
      eventType: SecurityEventType.MFA_CHALLENGE_STARTED,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: AuthEntryMethod.OTP,
      metadata: {
        challengeId: saved.id,
        purpose: 'customer_login_otp',
        identifierKind: dto.identifierKind,
        deliveryChannel: delivery.deliveryChannel,
      },
      ...context,
    });

    return {
      accepted: true,
      challengeId: saved.id,
      maskedDestination: delivery.maskedDestination,
      deliveryChannel: delivery.deliveryChannel,
      expiresAt: expiresAt.toISOString(),
      retryAfterSeconds: 60,
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

    const otpMatches = await this.verifyCustomerOtpLoginChallenge(user, dto);

    if (!otpMatches) {
      await this.securityAuditService.log({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        email: user.email,
        success: false,
        reason: 'invalid_otp_code',
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

    return this.createSuccessfulLoginResponse(
      authResult,
      user,
      AuthEntryMethod.OTP,
    );
  }

  async createActivatedCustomerSession(
    user: User,
    context: SecurityContext,
  ): Promise<AuthResponseDto> {
    await this.usersService.ensureUserCanLogin(user);

    const authResult = await this.createAuthenticatedSession(
      user,
      1,
      context,
      context.deviceId,
    );

    await this.usersService.recordSuccessfulLogin(user.id);
    await this.securityAuditService.log({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      success: true,
      authMethod: AuthEntryMethod.OTP,
      authProvider: user.authProvider,
      metadata: {
        activationAutoLogin: true,
        sessionId: authResult.sessionId,
      },
      ...context,
    });

    const refreshedUser = await this.usersService.requireById(user.id);
    return this.createSuccessfulLoginResponse(
      authResult,
      refreshedUser,
      AuthEntryMethod.OTP,
    );
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

    return this.createSuccessfulLoginResponse(authResult, user, entryMethod);
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

    return this.createSuccessfulLoginResponse(
      authResult,
      user,
      AuthEntryMethod.WEBAUTHN,
    );
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
            entryMethod,
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
      user: await this.createUserResponse(user),
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

    return this.createSuccessfulLoginResponse(authResult, user, entryMethod);
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
      user: await this.createUserResponse(user),
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

  private findUserForOtpRequest(dto: RequestOtpLoginDto): Promise<User | null> {
    return this.findUserForOtpIdentifier(dto.identifier, dto.identifierKind);
  }

  private async findUserForOtpLogin(dto: OtpLoginDto): Promise<User | null> {
    return this.findUserForOtpIdentifier(dto.identifier, dto.identifierKind);
  }

  private async findUserForPasswordLoginIdentifier(
    rawIdentifier: string,
  ): Promise<PasswordLoginIdentity> {
    const identifier = rawIdentifier.trim();
    const normalizedIdentifier = identifier.toLowerCase();

    if (normalizedIdentifier.includes('@')) {
      return {
        identifier: normalizedIdentifier,
        identifierKind: 'email',
        user: await this.usersService.findByEmail(normalizedIdentifier, true),
      };
    }

    if (/^[+\d\s()-]+$/.test(identifier)) {
      const normalizedPhone = this.normalizeOtpPhoneIdentifier(identifier);
      const phoneUser = await this.usersService.findByPhoneNumber(
        normalizedPhone,
        true,
      );

      if (phoneUser) {
        return {
          identifier: normalizedPhone,
          identifierKind: 'phone',
          user: phoneUser,
        };
      }

      if (this.looksLikeTin(identifier)) {
        const tinUser = await this.findCustomerUserByTin(identifier, true);

        if (tinUser) {
          return {
            identifier: this.normalizeTinIdentifier(identifier),
            identifierKind: 'tin',
            user: tinUser,
          };
        }
      }
    }

    if (this.looksLikeTin(identifier)) {
      const tinUser = await this.findCustomerUserByTin(identifier, true);

      if (tinUser) {
        return {
          identifier: this.normalizeTinIdentifier(identifier),
          identifierKind: 'tin',
          user: tinUser,
        };
      }
    }

    return {
      identifier: normalizedIdentifier,
      identifierKind: 'username',
      user: await this.usersService.findByStaffLoginIdentifier(
        normalizedIdentifier,
        true,
      ),
    };
  }

  private async resolveUnlinkedActiveDirectoryStaffLogin(
    username: string,
    password: string,
  ): Promise<User | null> {
    if (!this.activeDirectoryService.isConfigured()) {
      return null;
    }

    let profile: ActiveDirectoryAuthenticatedProfile;

    try {
      profile = await this.activeDirectoryService.authenticate({
        username,
        password,
      });
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        return null;
      }

      throw error;
    }

    return this.findProvisionedActiveDirectoryStaffForProfile(profile);
  }

  private async findProvisionedActiveDirectoryStaffForProfile(
    profile: ActiveDirectoryAuthenticatedProfile,
  ): Promise<User | null> {
    if (!profile.emailAddress) {
      return null;
    }

    const user = await this.usersService.findByEmail(
      profile.emailAddress,
      true,
    );

    if (
      !user ||
      user.authProvider !== AuthProvider.AD ||
      !this.isStaffUser(user)
    ) {
      return null;
    }

    return this.activeDirectoryService.syncAuthenticatedProfile(user, profile);
  }

  private async findUserForOtpIdentifier(
    rawIdentifier: string,
    identifierKind?: 'phone' | 'email' | 'tin',
  ): Promise<User | null> {
    const identifier = rawIdentifier.trim();
    const normalizedEmail = identifier.toLowerCase();

    if (identifierKind === 'email' || normalizedEmail.includes('@')) {
      return this.usersService.findByEmail(normalizedEmail);
    }

    if (identifierKind === 'tin') {
      return this.findCustomerUserByTin(identifier);
    }

    if (identifierKind === 'phone' || /^[+\d\s()-]+$/.test(identifier)) {
      const user = await this.usersService.findByPhoneNumber(
        this.normalizeOtpPhoneIdentifier(identifier),
      );

      if (user) {
        return user;
      }

      if (identifierKind === 'phone') {
        return null;
      }
    }

    return this.looksLikeTin(identifier)
      ? this.findCustomerUserByTin(identifier)
      : null;
  }

  private async verifyCustomerOtpLoginChallenge(
    user: User,
    dto: OtpLoginDto,
  ): Promise<boolean> {
    const challenge = await this.findCustomerOtpLoginChallenge(user, dto);

    if (!challenge) {
      if (dto.challengeId) {
        return false;
      }

      const expectedOtp = this.getConfiguredOtpLoginCode();
      return Boolean(expectedOtp && dto.otp.trim() === expectedOtp);
    }

    if (challenge.expiresAt < new Date()) {
      return false;
    }

    const purpose = String(challenge.payload?.purpose ?? '');
    const otpHash = String(challenge.payload?.otpHash ?? '');

    if (purpose !== 'customer_login_otp' || !otpHash) {
      return false;
    }

    const valid = await this.passwordService.compare(dto.otp.trim(), otpHash);

    if (!valid) {
      return false;
    }

    challenge.isUsed = true;
    await this.authChallengeRepo.save(challenge);

    return true;
  }

  private async findCustomerOtpLoginChallenge(
    user: User,
    dto: OtpLoginDto,
  ): Promise<AuthChallenge | null> {
    if (dto.challengeId) {
      return this.authChallengeRepo.findOne({
        where: {
          id: dto.challengeId,
          userId: user.id,
          type: AuthChallengeType.MFA,
          isUsed: false,
        },
      });
    }

    const challenges = await this.authChallengeRepo.find({
      where: {
        userId: user.id,
        type: AuthChallengeType.MFA,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return (
      challenges.find(
        (challenge) => challenge.payload?.purpose === 'customer_login_otp',
      ) ?? null
    );
  }

  private resolveCustomerOtpDelivery(
    user: User,
    dto: RequestOtpLoginDto,
  ): CustomerOtpDelivery | null {
    const requested = dto.deliveryChannel;
    const email = user.email?.trim();
    const phoneNumber = user.phoneNumber?.trim();

    if (requested === 'email' && email) {
      return {
        deliveryChannel: 'email',
        destination: email,
        maskedDestination: this.maskEmail(email),
      };
    }

    if (requested === 'sms' && phoneNumber) {
      return {
        deliveryChannel: 'sms',
        destination: phoneNumber,
        maskedDestination: this.maskPhone(phoneNumber),
      };
    }

    if (phoneNumber) {
      return {
        deliveryChannel: 'sms',
        destination: phoneNumber,
        maskedDestination: this.maskPhone(phoneNumber),
      };
    }

    if (email) {
      return {
        deliveryChannel: 'email',
        destination: email,
        maskedDestination: this.maskEmail(email),
      };
    }

    return null;
  }

  private async findCustomerUserByTin(
    identifier: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedIdentifier = this.normalizeTinIdentifier(identifier);
    const customer =
      (await this.bulkCustomersRepository.findByTin(normalizedIdentifier)) ??
      (await this.bulkCustomersRepository.findByRegistrationNumber(
        normalizedIdentifier,
      ));

    if (!customer) {
      return null;
    }

    const email = customer.email?.trim().toLowerCase();
    if (email) {
      const user = await this.usersService.findByEmail(email, includePassword);
      if (user) {
        return user;
      }
    }

    const phone = customer.phone?.trim() || customer.businessPhone?.trim();
    if (phone) {
      return this.usersService.findByPhoneNumber(
        this.normalizeOtpPhoneIdentifier(phone),
        includePassword,
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

  private maskEmail(email: string): string {
    const [localPart, domain = ''] = email.split('@');
    const visibleLocal = localPart.slice(0, 2);
    return `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
  }

  private maskPhone(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
  }

  private generateNumericOtp(length: number): string {
    const digits = '0123456789';
    let value = '';

    for (let index = 0; index < length; index += 1) {
      value += digits[crypto.randomInt(0, digits.length)];
    }

    return value;
  }

  private getConfiguredOtpLoginCode(): string | null {
    const configured =
      process.env.DEMO_LOGIN_OTP ?? process.env.AUTH_OTP_LOGIN_CODE;
    const code =
      configured?.trim() ||
      (process.env.SEED_DEMO_USERS === 'true' ? '12345' : '');

    return /^\d{5}$/.test(code) ? code : null;
  }

  private getPasswordLoginIdentifier(dto: LoginDto): string {
    const identifier = (
      dto.identifier ??
      dto.username ??
      dto.email ??
      dto.phoneNumber ??
      ''
    )
      .trim()
      .toLowerCase();

    if (!identifier) {
      throw new BadRequestException(
        'TIN, phone number, email, or staff username is required',
      );
    }

    return identifier;
  }

  private canUsePasswordLogin(
    user: User,
    identifierKind: PasswordLoginIdentifierKind,
  ): boolean {
    if (this.isStaffUser(user)) {
      return (
        (user.authProvider === AuthProvider.AD ||
          user.authProvider === AuthProvider.LOCAL) &&
        identifierKind === 'username'
      );
    }

    return (
      this.isCustomerOnlyUser(user) &&
      user.authProvider === AuthProvider.LOCAL &&
      ['email', 'phone', 'tin'].includes(identifierKind)
    );
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
      user: await this.createUserResponse(user),
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

  private async createSuccessfulLoginResponse(
    authResult: {
      accessToken: string;
      refreshToken: string;
      sessionId: string;
    },
    user: User,
    entryMethod: AuthEntryMethod,
  ): Promise<AuthResponseDto> {
    const promptPasswordlessSetup = await this.shouldPromptPasswordlessSetup(
      user,
      entryMethod,
    );

    return {
      ...authResult,
      mfaRequired: false,
      user: await this.createUserResponse(user),
      promptPasswordlessSetup,
      passwordlessSetupPrompt: promptPasswordlessSetup
        ? {
            title: 'Set up faster sign-in',
            message:
              'Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.',
            setupUrl: '/console?section=security',
          }
        : undefined,
    };
  }

  private async createUserResponse(user: User): Promise<UserResponseDto> {
    const response = plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
    const customerId = await this.resolveCustomerIdForUser(user);

    if (customerId) {
      response.customerId = customerId;
    }

    return response;
  }

  private async resolveCustomerIdForUser(user: User): Promise<string | null> {
    if (!user.roles.includes(UserRole.CUSTOMER)) {
      return null;
    }

    const customer = await this.bulkCustomersRepository.findByEmail(user.email);

    return customer?.id ?? null;
  }

  private async shouldPromptPasswordlessSetup(
    user: User,
    entryMethod: AuthEntryMethod,
  ): Promise<boolean> {
    if (
      entryMethod === AuthEntryMethod.WEBAUTHN ||
      entryMethod === AuthEntryMethod.PASSKEY ||
      entryMethod === AuthEntryMethod.SECURITY_KEY
    ) {
      return false;
    }

    return !(await this.mfaFactorSelectorService.isMethodEnabled(
      user.id,
      MfaMethod.WEBAUTHN,
    ));
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
