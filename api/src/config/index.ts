/**
 * @file configuration.ts
 * @description Centralized environment configuration using NestJS ConfigModule.
 * All environment variables are mapped and typed here.
 * Usage: inject ConfigService and call config.get<string>('database.host')
 */

export const configuration = () => ({
  app: {
    name: process.env.APP_NAME ?? 'Compleo-MTK',
    port: Number.parseInt(process.env.PORT ?? '9089', 10),
    env: process.env.NODE_ENV ?? 'development',
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    apiUrl: process.env.API_URL ?? 'http://localhost:3001',
    backendUrl: process.env.BACKEND_URL ?? 'http://localhost:8086',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? '',
    name: process.env.DB_NAME ?? 'your-database-name',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true',
    poolSize: Number.parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: Number.parseInt(process.env.REDIS_DB ?? '0', 10),
    ttl: Number.parseInt(process.env.REDIS_TTL_DEFAULT ?? '3600', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'compleo-mtk:',
  },

  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ??
      process.env.JWT_SECRET ??
      'replace-with-strong-secret',
    accessExpiresIn:
      process.env.JWT_ACCESS_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'replace-with-strong-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  auth: {
    maxActiveSessions: Number.parseInt(
      process.env.AUTH_MAX_ACTIVE_SESSIONS ?? '3',
      10,
    ),
    requireVerifiedEmailLocal:
      process.env.AUTH_REQUIRE_VERIFIED_ESMTP_LOCAL === 'true',
    requireVerifiedEmailSocial:
      process.env.AUTH_REQUIRE_VERIFIED_ESMTP_SOCIAL === 'true',
    requireVerifiedPhoneSensitive:
      process.env.AUTH_REQUIRE_VERIFIED_PHONE_SENSITIVE === 'true',

    allowPassword: process.env.AUTH_ALLOW_PASSWORD !== 'false',
    allowGoogle: process.env.AUTH_ALLOW_GOOGLE !== 'false',
    allowMicrosoft: process.env.AUTH_ALLOW_MICROSOFT !== 'false',
    allowWebauthn: process.env.AUTH_ALLOW_WEBAUTHN !== 'false',
    allowPasskey: process.env.AUTH_ALLOW_PASSKEY !== 'false',
    allowSecurityKey: process.env.AUTH_ALLOW_SECURITY_KEY !== 'false',

    deviceTrustStrict: process.env.AUTH_DEVICE_TRUST_STRICT === 'true',
    blockOnRecoveryPolicyViolation:
      process.env.AUTH_BLOCK_ON_RECOVERY_POLICY_VIOLATION === 'true',
    forceMfaForPrivileged: process.env.AUTH_FORCE_MFA_FOR_PRIVILEGED === 'true',
  },

  mfa: {
    enabled: process.env.AUTH_MFA_ENABLED === 'true',
    issuer: process.env.AUTH_MFA_ISSUER ?? 'Bulk Data Wholesale',
    totpWindow: Number.parseInt(process.env.AUTH_MFA_TOTP_WINDOW ?? '1', 10),

    recoveryCodes: {
      enabled: process.env.AUTH_RECOVERY_CODES_ENABLED === 'true',
      count: Number.parseInt(process.env.AUTH_RECOVERY_CODES_COUNT ?? '10', 10),
      minThreshold: Number.parseInt(
        process.env.AUTH_RECOVERY_CODES_MIN_THRESHOLD ?? '2',
        10,
      ),
      requireReauth: process.env.AUTH_RECOVERY_CODES_REQUIRE_REAUTH === 'true',
      maxAttempts: Number.parseInt(
        process.env.AUTH_RECOVERY_CODES_MAX_ATTEMPTS ?? '5',
        10,
      ),
      attemptWindowSeconds: Number.parseInt(
        process.env.AUTH_RECOVERY_CODES_ATTEMPT_WINDOW_SECONDS ?? '900',
        10,
      ),
      lockSeconds: Number.parseInt(
        process.env.AUTH_RECOVERY_CODES_LOCK_SECONDS ?? '900',
        10,
      ),
    },
  },

  risk: {
    stepUpThreshold: Number.parseInt(
      process.env.AUTH_RISK_STEP_UP_THRESHOLD ?? '4',
      10,
    ),
    enableIpValidation: process.env.AUTH_RISK_ENABLE_IP_VALIDATION === 'true',
    enableDeviceTracking:
      process.env.AUTH_RISK_ENABLE_DEVICE_TRACKING === 'true',
    enableImpossibleTravel:
      process.env.AUTH_RISK_ENABLE_IMPOSSIBLE_TRAVEL === 'true',
    enableTimeAnalysis: process.env.AUTH_RISK_ENABLE_TIME_ANALYSIS === 'true',
  },

  session: {
    ttlSeconds: Number.parseInt(
      process.env.AUTH_SESSION_TTL_SECONDS ?? '86400',
      10,
    ),
    idleTimeoutSeconds: Number.parseInt(
      process.env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS ?? '1800',
      10,
    ),
    rotationEnabled: process.env.AUTH_SESSION_ROTATION_ENABLED === 'true',
    maxActiveSessions: Number.parseInt(
      process.env.AUTH_MAX_ACTIVE_SESSIONS ?? '3',
      10,
    ),
  },

  otp: {
    expirySeconds: Number.parseInt(process.env.OTP_EXPIRY_SECONDS ?? '180', 10),
    maxAttempts: Number.parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10),
  },

  throttle: {
    ttl: Number.parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: Number.parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authTtl: Number.parseInt(process.env.AUTH_THROTTLE_TTL ?? '60000', 10),
    authLimit: Number.parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
  },

  webauthn: {
    rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Bulk Data Wholesale',
    origin: process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/api/auth/google/callback',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID ?? '',
      teamId: process.env.APPLE_TEAM_ID ?? '',
      keyId: process.env.APPLE_KEY_ID ?? '',
      privateKey: process.env.APPLE_PRIVATE_KEY ?? '',
      callbackUrl:
        process.env.APPLE_CALLBACK_URL ??
        'http://localhost:3000/api/auth/apple/callback',
    },
  },

  email: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from:
      process.env.SENDER_ADDRESS ??
      'Bulk Data Wholesale <no-reply@bulk-data.com>',
  },

  sms: {
    provider: process.env.SMS_PROVIDER ?? 'africastalking',
    africastalking: {
      username: process.env.AFRICASTALKING_USERNAME ?? '',
      app: process.env.AFRICASTALKING_APP ?? '',
      apiKey: process.env.AFRICASTALKING_API_KEY ?? '',
      senderId: process.env.AFRICASTALKING_SENDER_ID ?? '',
      enqueue: process.env.AFRICASTALKING_ENQUEUE === 'true',
    },
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_ESMTP ?? '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
  },

  apnProvider: {
    url: process.env.APN_PROVIDER_URL ?? '',
    partnerId: process.env.APN_PROVIDER_PARTNER_ID ?? '',
    apiKey: process.env.APN_PROVIDER_API_KEY ?? '',
    timeoutMs: Number.parseInt(
      process.env.APN_PROVIDER_TIMEOUT_MS ?? '15000',
      10,
    ),
    tlsRejectUnauthorized:
      process.env.APN_PROVIDER_TLS_REJECT_UNAUTHORIZED !== 'false',
  },

  provisioning: {
    provider: process.env.PROVISIONING_PROVIDER ?? 'pcrf',
    pcrf: {
      baseUrl:
        process.env.PROVISIONING_PCRF_BASE_URL ??
        process.env.PCRF_BASE_URL ??
        '',
      timeoutMs: Number.parseInt(
        process.env.PROVISIONING_PCRF_TIMEOUT_MS ??
          process.env.PCRF_TIMEOUT_MS ??
          '15000',
        10,
      ),
      bearerToken:
        process.env.PROVISIONING_PCRF_BEARER_TOKEN ??
        process.env.PCRF_BEARER_TOKEN ??
        '',
      apiKey:
        process.env.PROVISIONING_PCRF_API_KEY ?? process.env.PCRF_API_KEY ?? '',
      paths: {
        groupMember:
          process.env.PROVISIONING_PCRF_GROUP_MEMBER_PATH ??
          process.env.PCRF_GROUP_MEMBER_PATH ??
          '/api/pcrf/group-member',
        groupMembersBulk:
          process.env.PROVISIONING_PCRF_GROUP_MEMBERS_BULK_PATH ??
          process.env.PCRF_GROUP_MEMBERS_BULK_PATH ??
          '/api/pcrf/group-members/bulk',
        groupMemberDelete:
          process.env.PROVISIONING_PCRF_GROUP_MEMBER_DELETE_PATH ??
          process.env.PCRF_GROUP_MEMBER_DELETE_PATH ??
          '/api/pcrf/group-member/delete',
        subscriptionUpdate:
          process.env.PROVISIONING_PCRF_SUBSCRIPTIONS_UPDATE_PATH ??
          process.env.PCRF_SUBSCRIPTIONS_UPDATE_PATH ??
          '/api/pcrf/subscriptions/update',
        subscriber:
          process.env.PROVISIONING_PCRF_SUBSCRIBER_PATH ??
          process.env.PCRF_SUBSCRIBER_PATH ??
          '/api/pcrf/subscriber',
        subscribeService:
          process.env.PROVISIONING_PCRF_SUBSCRIBE_PATH ??
          process.env.PCRF_SUBSCRIBE_PATH ??
          '/api/pcrf/subscribe',
      },
      urls: {
        subscribeService:
          process.env.PROVISIONING_PCRF_SUBSCRIBE_URL ??
          process.env.PCRF_SUBSCRIBE_URL ??
          '',
      },
    },
  },

  payments: {
    simulateStatusUpdates:
      process.env.SIMULATE_PAYMENT_STATUS_UPDATES === 'true',
    provider: {
      initUrl: process.env.PAYMENT_PROVIDER_INIT_URL ?? '',
      apiKey: process.env.PAYMENT_PROVIDER_API_KEY ?? '',
      bearerToken: process.env.PAYMENT_PROVIDER_BEARER_TOKEN ?? '',
      timeoutMs: Number.parseInt(
        process.env.PAYMENT_PROVIDER_TIMEOUT_MS ?? '15000',
        10,
      ),
      callbackBaseUrl:
        process.env.PAYMENT_CALLBACK_BASE_URL ??
        process.env.BACKEND_URL ??
        'http://localhost:9089',
    },
    prnProvider: {
      initUrl: process.env.PAYMENT_PRN_PROVIDER_INIT_URL ?? '',
      apiKey:
        process.env.PAYMENT_PRN_PROVIDER_API_KEY ??
        process.env.PAYMENT_PROVIDER_API_KEY ??
        '',
      bearerToken:
        process.env.PAYMENT_PRN_PROVIDER_BEARER_TOKEN ??
        process.env.PAYMENT_PROVIDER_BEARER_TOKEN ??
        '',
      timeoutMs: Number.parseInt(
        process.env.PAYMENT_PRN_PROVIDER_TIMEOUT_MS ??
          process.env.PAYMENT_PROVIDER_TIMEOUT_MS ??
          '15000',
        10,
      ),
    },
    momoProvider: {
      mode: process.env.PAYMENT_MOMO_PROVIDER_MODE ?? 'provider',
      initUrl: process.env.PAYMENT_MOMO_PROVIDER_INIT_URL ?? '',
      apiKey:
        process.env.PAYMENT_MOMO_PROVIDER_API_KEY ??
        process.env.PAYMENT_PROVIDER_API_KEY ??
        '',
      bearerToken:
        process.env.PAYMENT_MOMO_PROVIDER_BEARER_TOKEN ??
        process.env.PAYMENT_PROVIDER_BEARER_TOKEN ??
        '',
      timeoutMs: Number.parseInt(
        process.env.PAYMENT_MOMO_PROVIDER_TIMEOUT_MS ??
          process.env.PAYMENT_PROVIDER_TIMEOUT_MS ??
          '15000',
        10,
      ),
      spTransfer: {
        url: process.env.PAYMENT_MOMO_SPTRANSFER_URL ?? '',
        baseUrl:
          process.env.PAYMENT_MOMO_SPTRANSFER_BASE_URL ??
          process.env.ECW_API_URL ??
          '',
        path: process.env.PAYMENT_MOMO_SPTRANSFER_PATH ?? '/sptransfer/',
        fromFri: process.env.PAYMENT_MOMO_SPTRANSFER_FROM_FRI ?? '',
        toFri: process.env.PAYMENT_MOMO_SPTRANSFER_TO_FRI ?? '',
        username: process.env.PAYMENT_MOMO_SPTRANSFER_USERNAME ?? '',
        password: process.env.PAYMENT_MOMO_SPTRANSFER_PASSWORD ?? '',
      },
    },
    airtimeProvider: {
      initUrl:
        process.env.PAYMENT_AIRTIME_PROVIDER_INIT_URL ??
        (process.env.PROVISIONING_PCRF_BASE_URL
          ? new URL(
              (
                process.env.PAYMENT_AIRTIME_UPDATE_BALANCE_PATH ??
                '/api/update-balance-and-date'
              ).replace(/^\/+/, ''),
              process.env.PROVISIONING_PCRF_BASE_URL.endsWith('/')
                ? process.env.PROVISIONING_PCRF_BASE_URL
                : `${process.env.PROVISIONING_PCRF_BASE_URL}/`,
            ).toString()
          : ''),
      updateBalancePath:
        process.env.PAYMENT_AIRTIME_UPDATE_BALANCE_PATH ??
        '/api/update-balance-and-date',
      apiKey:
        process.env.PAYMENT_AIRTIME_PROVIDER_API_KEY ??
        process.env.PAYMENT_PROVIDER_API_KEY ??
        '',
      bearerToken:
        process.env.PAYMENT_AIRTIME_PROVIDER_BEARER_TOKEN ??
        process.env.PAYMENT_PROVIDER_BEARER_TOKEN ??
        '',
      timeoutMs: Number.parseInt(
        process.env.PAYMENT_AIRTIME_PROVIDER_TIMEOUT_MS ??
          process.env.PAYMENT_PROVIDER_TIMEOUT_MS ??
          '15000',
        10,
      ),
    },
  },

  security: {
    auditLogEnabled: process.env.SECURITY_AUDIT_LOG_ENABLED === 'true',
    alertEmailEnabled: process.env.SECURITY_ALERT_ESMTP_ENABLED === 'true',
    alertSmsEnabled: process.env.SECURITY_ALERT_SMS_ENABLED === 'true',
  },

  bull: {
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
    },
  },
});

const config = configuration();

export default config;
