import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { User } from 'src/modules/users/entities/user.entity';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { UserStatus } from 'src/modules/users/enums/user-status.enum';
import { AuthProvider } from '../../enums/auth-provider.enum';
import { AuthFactorType } from '../../enums/auth-factor-type.enum';
import { SecurityContext } from '../../interfaces/security-context.interface';
import { SecurityAuditService } from './security-audit.service';
import { UserSessionsService } from 'src/modules/users/services/user-session.service';
import { AuthPolicyDecision, AuthRiskAssessment, RecoveryCodePolicyStatus } from '../../interfaces/auth-policy-decision.interface';
import { RedisService } from 'src/modules/redis/redis.service';
import { AuthEntryMethod } from '../../enums/auth-entry-method.enum';
import { MfaRecoveryCodeService } from '../mfa/mfa-recovery-codes.service';

/**
 * Centralizes authentication and security policy decisions.
 */
@Injectable()
export class AuthPolicyService {
  private readonly defaultMaxActiveSessions: number;
  private readonly requireVerifiedEmailForLocalLogin: boolean;
  private readonly requireVerifiedEmailForSocialLogin: boolean;
  private readonly requireVerifiedPhoneForSensitiveFlows: boolean;
  private readonly allowGoogleLogin: boolean;
  private readonly allowMicrosoftLogin: boolean;
  private readonly allowPasswordLogin: boolean;
  private readonly allowWebauthnLogin: boolean;
  private readonly allowPasskeyLogin: boolean;
  private readonly allowSecurityKeyLogin: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly securityAuditService: SecurityAuditService,
    private readonly userSessionsService: UserSessionsService,
    private readonly redisService: RedisService,
    private readonly mfaRecoveryCodeService: MfaRecoveryCodeService,
  ) {
    this.defaultMaxActiveSessions = this.configService.get<number>(
      'auth.maxActiveSessions',
      3,
    );

    this.requireVerifiedEmailForLocalLogin = this.configService.get<boolean>(
      'auth.requireVerifiedEmailForLocalLogin',
      true,
    );

    this.requireVerifiedEmailForSocialLogin = this.configService.get<boolean>(
      'auth.requireVerifiedEmailForSocialLogin',
      false,
    );

    this.requireVerifiedPhoneForSensitiveFlows =
      this.configService.get<boolean>(
        'auth.requireVerifiedPhoneForSensitiveFlows',
        false,
      );

    this.allowGoogleLogin = this.configService.get<boolean>(
      'auth.allowGoogleLogin',
      true,
    );

    this.allowMicrosoftLogin = this.configService.get<boolean>(
      'auth.allowMicrosoftLogin',
      true,
    );

    this.allowPasswordLogin = this.configService.get<boolean>(
      'auth.allowPasswordLogin',
      true,
    );

    this.allowWebauthnLogin = this.configService.get<boolean>(
      'auth.allowWebauthnLogin',
      true,
    );

    this.allowPasskeyLogin = this.configService.get<boolean>(
      'auth.allowPasskeyLogin',
      true,
    );

    this.allowSecurityKeyLogin = this.configService.get<boolean>(
      'auth.allowSecurityKeyLogin',
      true,
    );
  }

  /**
   * Evaluates whether a user may authenticate through the specified method,
   * and what additional controls apply.
   */
  async evaluateLoginPolicy(
    user: User,
    method: AuthEntryMethod,
    context?: SecurityContext,
  ): Promise<AuthPolicyDecision> {
    this.assertUserStateAllowsAuthentication(user);

    const risk = await this.assessRisk(user, method, context);
    const recoveryCodePolicy = await this.evaluateRecoveryCodePolicy(user);
    this.applyRecoveryCodePolicyToRisk(risk, recoveryCodePolicy);

    const requiresMfa = this.shouldRequireMfa(user, method, risk);
    const requiresStepUp = risk.requiresStepUp;

    switch (method) {
      case AuthEntryMethod.PASSWORD:
        this.assertPasswordLoginAllowed(user);
        return {
          allow: true,
          requiresEmailVerification: this.requireVerifiedEmailForLocalLogin,
          requiresPhoneVerification: false,
          requiresMfa,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.OTP:
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp: false,
          allowedFactors: [AuthFactorType.SMS_OTP, AuthFactorType.EMAIL_OTP],
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.GOOGLE:
        this.assertGoogleLoginAllowed(user);
        return {
          allow: true,
          requiresEmailVerification: this.requireVerifiedEmailForSocialLogin,
          requiresPhoneVerification: false,
          requiresMfa,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.MICROSOFT:
        this.assertMicrosoftLoginAllowed(user);
        return {
          allow: true,
          requiresEmailVerification: this.requireVerifiedEmailForSocialLogin,
          requiresPhoneVerification: false,
          requiresMfa,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.WEBAUTHN:
        this.assertWebauthnLoginAllowed();
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.PASSKEY:
        this.assertPasskeyLoginAllowed();
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.SECURITY_KEY:
        this.assertSecurityKeyLoginAllowed();
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp,
          allowedFactors: this.buildAllowedFactors(user, method),
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.REFRESH:
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp: false,
          allowedFactors: [],
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      case AuthEntryMethod.TOTP:
        return {
          allow: true,
          requiresEmailVerification: false,
          requiresPhoneVerification: this.requireVerifiedPhoneForSensitiveFlows,
          requiresMfa: false,
          requiresStepUp: false,
          allowedFactors: [AuthFactorType.TOTP],
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
        };

      default:
        return {
          allow: false,
          requiresEmailVerification: false,
          requiresPhoneVerification: false,
          requiresMfa: false,
          requiresStepUp: false,
          allowedFactors: [],
          maxActiveSessions: this.defaultMaxActiveSessions,
          risk,
          recoveryCodePolicy,
          reason: 'unsupported_authentication_method',
        };
    }
  }

  /**
   * Builds an explainable risk assessment for the current authentication attempt.
   */
  async assessRisk(
    user: User,
    method: AuthEntryMethod,
    context?: SecurityContext,
  ): Promise<AuthRiskAssessment> {
    const reasons: string[] = [];
    const metadata: Record<string, unknown> = {};
    let score = 0;

    if (!context) {
      return {
        score: 0,
        suspicious: false,
        requiresStepUp: false,
        reasons,
        metadata,
      };
    }

    /**
     * 1. Missing or malformed metadata
     */
    if (!context.userAgent) {
      score += 2;
      reasons.push('missing_user_agent');
    }

    if (!context.ipAddress) {
      score += 2;
      reasons.push('missing_ip_address');
    }

    if (!context.deviceId) {
      score += 2;
      reasons.push('missing_device_id');
    }

    if (!context.deviceType) {
      score += 1;
      reasons.push('missing_device_type');
    }

    if (!context.browser || !context.os) {
      score += 1;
      reasons.push('incomplete_client_fingerprint');
    }

    /**
     * 2. IP heuristics
     */
    if (context.ipAddress) {
      metadata.currentIpAddress = context.ipAddress;

      if (!this.isValidIp(context.ipAddress)) {
        score += 3;
        reasons.push('invalid_ip_format');
      }

      if (this.isPrivateOrLoopbackIp(context.ipAddress)) {
        score += 2;
        reasons.push('private_or_loopback_ip');
      }
    }

    /**
     * 3. User-agent sanity checks
     */
    if (context.userAgent) {
      const ua = context.userAgent.toLowerCase();

      if (
        ua.includes('curl') ||
        ua.includes('wget') ||
        ua.includes('postman') ||
        ua.includes('python') ||
        ua.includes('axios')
      ) {
        score += 3;
        reasons.push('non_browser_client_signature');
      }
    }

    /**
     * 4. Known device checks
     */
    const knownDevice = await this.userSessionsService.isKnownDevice(
      user.id,
      context.deviceId,
    );

    metadata.knownDevice = knownDevice;

    if (context.deviceId && !knownDevice) {
      score += 2;
      reasons.push('new_device');
    }

    /**
     * 5. Compare with recent successful login context
     */
    const previousContext = await this.getPreviousSuccessfulLoginContext(
      user.id,
    );

    if (previousContext?.ipAddress && context.ipAddress) {
      metadata.previousIpAddress = previousContext.ipAddress;

      if (previousContext.ipAddress !== context.ipAddress) {
        score += 1;
        reasons.push('ip_changed_since_last_successful_login');
      }
    }

    if (previousContext?.deviceId && context.deviceId) {
      metadata.previousDeviceId = previousContext.deviceId;

      if (previousContext.deviceId !== context.deviceId) {
        score += 1;
        reasons.push('device_changed_since_last_successful_login');
      }
    }

    if (previousContext?.countryCode && context.countryCode) {
      metadata.previousCountryCode = previousContext.countryCode;

      if (previousContext.countryCode !== context.countryCode) {
        score += 2;
        reasons.push('country_changed_since_last_successful_login');
      }
    }

    /**
     * 6. Impossible travel approximation
     */
    if (
      previousContext?.latitude != null &&
      previousContext?.longitude != null &&
      context.latitude != null &&
      context.longitude != null &&
      previousContext?.occurredAt
    ) {
      const distanceKm = this.calculateDistanceKm(
        previousContext.latitude,
        previousContext.longitude,
        context.latitude,
        context.longitude,
      );

      const now = context.occurredAt ?? new Date();
      const elapsedHours =
        (now.getTime() - new Date(previousContext.occurredAt).getTime()) /
        (1000 * 60 * 60);

      metadata.distanceKm = distanceKm;
      metadata.elapsedHoursSinceLastSuccessfulLogin = elapsedHours;

      if (elapsedHours > 0 && distanceKm / elapsedHours > 800) {
        score += 5;
        reasons.push('impossible_travel_detected');
      }
    }

    /**
     * 7. Recent security event correlation
     */
    const recentFailedLogins =
      await this.securityAuditService.countRecentFailedLogins(user.id, 30);

    metadata.recentFailedLogins = recentFailedLogins;

    if (recentFailedLogins >= 3) {
      score += 3;
      reasons.push('recent_failed_login_burst');
    }

    /**
     * 8. Time anomaly
     */
    const occurredAt = context.occurredAt ?? new Date();
    const hour = occurredAt.getHours();
    metadata.occurredHour = hour;

    if (hour >= 0 && hour <= 4) {
      score += 1;
      reasons.push('unusual_time_window');
    }

    /**
     * 9. Method-specific adjustments
     */
    if (
      method === AuthEntryMethod.PASSWORD &&
      !knownDevice &&
      recentFailedLogins > 0
    ) {
      score += 1;
      reasons.push('new_device_after_recent_failures');
    }

    const requiresStepUp = score >= 4;

    return {
      score,
      suspicious: score > 0,
      requiresStepUp,
      reasons,
      metadata,
    };
  }

  /**
   * Enforces a policy decision and throws if the method is not allowed.
   */
  enforceDecision(decision: AuthPolicyDecision): void {
    if (!decision.allow) {
      throw new ForbiddenException(
        decision.reason ?? 'Authentication method is not allowed',
      );
    }
  }

  /**
   * Ensures the user account is in a state that allows authentication.
   */
  assertUserStateAllowsAuthentication(user: User): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    if (user.status === UserStatus.LOCKED || user.isLocked) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException(
          `Account is locked until ${user.lockedUntil.toISOString()}`,
        );
      }

      throw new UnauthorizedException('Account is locked');
    }
  }

  /**
   * Ensures local password authentication is allowed for the user.
   */
  assertPasswordLoginAllowed(user: User): void {
    if (!this.allowPasswordLogin) {
      throw new ForbiddenException('Password authentication is disabled');
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException(
        'This account does not support password authentication',
      );
    }
  }

  /**
   * Ensures Google authentication is allowed for the user.
   */
  assertGoogleLoginAllowed(user: User): void {
    if (!this.allowGoogleLogin) {
      throw new ForbiddenException('Google authentication is disabled');
    }

    if (
      user.authProvider !== AuthProvider.GOOGLE &&
      user.authProvider !== AuthProvider.LOCAL &&
      user.authProvider !== AuthProvider.MICROSOFT
    ) {
      throw new UnauthorizedException(
        'This account does not support Google authentication',
      );
    }
  }

  /**
   * Ensures Microsoft authentication is allowed for the user.
   */
  assertMicrosoftLoginAllowed(user: User): void {
    if (!this.allowMicrosoftLogin) {
      throw new ForbiddenException('Microsoft authentication is disabled');
    }

    if (
      user.authProvider !== AuthProvider.MICROSOFT &&
      user.authProvider !== AuthProvider.LOCAL &&
      user.authProvider !== AuthProvider.GOOGLE
    ) {
      throw new UnauthorizedException(
        'This account does not support Microsoft authentication',
      );
    }
  }

  /**
   * Ensures WebAuthn authentication is enabled globally.
   */
  assertWebauthnLoginAllowed(): void {
    if (!this.allowWebauthnLogin) {
      throw new ForbiddenException('WebAuthn authentication is disabled');
    }
  }

  /**
   * Ensures passkey authentication is enabled globally.
   */
  assertPasskeyLoginAllowed(): void {
    if (!this.allowPasskeyLogin) {
      throw new ForbiddenException('Passkey authentication is disabled');
    }
  }

  /**
   * Ensures security-key authentication is enabled globally.
   */
  assertSecurityKeyLoginAllowed(): void {
    if (!this.allowSecurityKeyLogin) {
      throw new ForbiddenException('Security-key authentication is disabled');
    }
  }
  async evaluateRecoveryCodePolicy(
    user: User,
  ): Promise<RecoveryCodePolicyStatus> {
    if (!user.mfaEnabled) {
      return {
        warning: false,
        policyViolation: false,
      };
    }

    const privilegedUser = this.isPrivilegedUser(user);
    const status = await this.mfaRecoveryCodeService.getStatus(
      user.id,
      privilegedUser,
    );

    if (!status.hasActiveBatch) {
      return {
        warning: true,
        policyViolation: privilegedUser,
        reason: 'no_active_recovery_codes',
      };
    }

    if (status.remainingCodes < 2) {
      return {
        warning: true,
        policyViolation: privilegedUser,
        reason: 'recovery_codes_running_low',
      };
    }

    return {
      warning: false,
      policyViolation: false,
    };
  }

  private applyRecoveryCodePolicyToRisk(
    risk: AuthRiskAssessment,
    recoveryCodePolicy: RecoveryCodePolicyStatus,
  ): void {
    risk.metadata = {
      ...(risk.metadata ?? {}),
      recoveryCodePolicy,
    };

    if (recoveryCodePolicy.warning && recoveryCodePolicy.reason) {
      risk.reasons = [...new Set([...risk.reasons, recoveryCodePolicy.reason])];
    }
  }
  /**
   *
   * Determines whether MFA should be required.
   */
  shouldRequireMfa(
    user: User,
    method: AuthEntryMethod,
    risk: AuthRiskAssessment,
  ): boolean {
    void risk;

    if (
      method === AuthEntryMethod.GOOGLE ||
      method === AuthEntryMethod.MICROSOFT ||
      method === AuthEntryMethod.WEBAUTHN ||
      method === AuthEntryMethod.PASSKEY ||
      method === AuthEntryMethod.SECURITY_KEY
    ) {
      return false;
    }

    if (!user.mfaEnabled) {
      return (
        method === AuthEntryMethod.PASSWORD &&
        user.roles.some((role) =>
          [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
            role,
          ),
        )
      );
    }

    return true;
  }

  /**
   * Validates email verification requirements.
   */
  assertEmailVerificationSatisfied(
    user: User,
    decision: AuthPolicyDecision,
  ): void {
    if (decision.requiresEmailVerification && !user.emailVerified) {
      throw new UnauthorizedException('Email verification is required');
    }
  }

  /**
   * Validates phone verification requirements.
   */
  assertPhoneVerificationSatisfied(
    user: User,
    decision: AuthPolicyDecision,
  ): void {
    if (decision.requiresPhoneVerification && !user.phoneVerified) {
      throw new UnauthorizedException('Phone verification is required');
    }
  }

  /**
   * Returns maximum active sessions allowed by policy.
   */
  getMaxActiveSessions(): number {
    return this.defaultMaxActiveSessions;
  }

  /**
   * Builds the set of factors allowed or expected for the method.
   */
  private buildAllowedFactors(
    user: User,
    method: AuthEntryMethod,
  ): AuthFactorType[] {
    const factors: AuthFactorType[] = [];

    switch (method) {
      case AuthEntryMethod.PASSWORD:
        factors.push(AuthFactorType.PASSWORD);
        break;
      case AuthEntryMethod.OTP:
        factors.push(AuthFactorType.SMS_OTP, AuthFactorType.EMAIL_OTP);
        break;
      case AuthEntryMethod.TOTP:
        factors.push(AuthFactorType.TOTP);
        break;
      case AuthEntryMethod.WEBAUTHN:
        factors.push(AuthFactorType.WEBAUTHN);
        break;
      case AuthEntryMethod.PASSKEY:
        factors.push(AuthFactorType.PASSKEY);
        break;
      case AuthEntryMethod.SECURITY_KEY:
        factors.push(AuthFactorType.SECURITY_KEY);
        break;
      default:
        break;
    }

    if (user.mfaEnabled) {
      factors.push(AuthFactorType.TOTP);
    }

    return [...new Set(factors)];
  }

  private isPrivilegedUser(user: User): boolean {
    if (!user || !Array.isArray(user.roles)) {
      return false;
    }

    const privileged = new Set<UserRole>([
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SUPPORT,
    ]);

    for (const role of user.roles) {
      if (privileged.has(role)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Retrieves the previous successful login context from Redis or audit history.
   */
  private async getPreviousSuccessfulLoginContext(userId: string): Promise<{
    ipAddress?: string | null;
    deviceId?: string | null;
    countryCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    occurredAt?: string | null;
  } | null> {
    const cacheKey = `auth:last-success:${userId}`;
    const cached = await this.redisService.get<{
      ipAddress?: string | null;
      deviceId?: string | null;
      countryCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      occurredAt?: string | null;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const lastLogin =
      await this.securityAuditService.findMostRecentSuccessfulLogin(userId);

    if (!lastLogin) {
      return null;
    }

    const context = {
      ipAddress: lastLogin.ipAddress ?? null,
      deviceId:
        typeof lastLogin.metadata?.deviceId === 'string'
          ? lastLogin.metadata.deviceId
          : null,
      countryCode:
        typeof lastLogin.metadata?.countryCode === 'string'
          ? lastLogin.metadata.countryCode
          : null,
      latitude:
        typeof lastLogin.metadata?.latitude === 'number'
          ? lastLogin.metadata.latitude
          : null,
      longitude:
        typeof lastLogin.metadata?.longitude === 'number'
          ? lastLogin.metadata.longitude
          : null,
      occurredAt: lastLogin.createdAt.toISOString(),
    };

    await this.redisService.set(cacheKey, context, 60 * 60 * 24 * 7);

    return context;
  }

  /**
   * Checks whether the IP address is syntactically valid.
   */
  private isValidIp(ip: string): boolean {
    const ipv4 =
      /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

    const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1)$/;

    return ipv4.test(ip) || ipv6.test(ip);
  }

  /**
   * Checks whether the IP is loopback or private-range.
   */
  private isPrivateOrLoopbackIp(ip: string): boolean {
    return (
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.2') ||
      ip === '::1'
    );
  }

  /**
   * Calculates geographic distance in kilometers using the Haversine formula.
   */
  private calculateDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;

    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  /**
   * Stores the latest successful login context for future risk comparisons.
   */
  async recordSuccessfulLoginContext(
    userId: string,
    context?: SecurityContext,
  ): Promise<void> {
    if (!context) return;

    await this.redisService.set(
      `auth:last-success:${userId}`,
      {
        ipAddress: context.ipAddress ?? null,
        deviceId: context.deviceId ?? null,
        countryCode: context.countryCode ?? null,
        latitude: context.latitude ?? null,
        longitude: context.longitude ?? null,
        occurredAt: (context.occurredAt ?? new Date()).toISOString(),
      },
      60 * 60 * 24 * 7,
    );
  }
}
