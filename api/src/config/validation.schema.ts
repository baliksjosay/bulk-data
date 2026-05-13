/**
 * @file env.validation.ts
 * @description Joi validation schema for environment variables.
 * Ensures correctness and prevents misconfiguration at startup.
 */

import Joi from 'joi';

export const validationSchema = Joi.object({
  // Core
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(9089),
  APP_NAME: Joi.string().default('Compleo-MTK'),

  APP_URL: Joi.string().uri().required(),
  API_URL: Joi.string().uri().required(),
  BACKEND_URL: Joi.string().uri().required(),
  FRONTEND_URL: Joi.string().uri().required(),

  ALLOWED_ORIGINS: Joi.string().required(),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),

  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_POOL_SIZE: Joi.number().min(1).default(10),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().min(0).default(0),
  REDIS_TTL_DEFAULT: Joi.number().min(1).default(3600),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().default('dev-access-secret'),
  }),

  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),

  // JWT — required in production
  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('dev-secret-change-me'),
  }),

  JWT_REFRESH_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('dev-refresh-secret'),
  }),

  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Auth Policy
  AUTH_MAX_ACTIVE_SESSIONS: Joi.number().min(1).default(3),
  AUTH_REQUIRE_VERIFIED_ESMTP_LOCAL: Joi.boolean()
    .truthy('true')
    .falsy('false'),
  AUTH_REQUIRE_VERIFIED_ESMTP_SOCIAL: Joi.boolean()
    .truthy('true')
    .falsy('false'),
  AUTH_REQUIRE_VERIFIED_PHONE_SENSITIVE: Joi.boolean()
    .truthy('true')
    .falsy('false'),

  // Auth Methods
  AUTH_ALLOW_PASSWORD: Joi.boolean().truthy('true').falsy('false'),
  AUTH_ALLOW_GOOGLE: Joi.boolean().truthy('true').falsy('false'),
  AUTH_ALLOW_MICROSOFT: Joi.boolean().truthy('true').falsy('false'),
  AUTH_ALLOW_WEBAUTHN: Joi.boolean().truthy('true').falsy('false'),
  AUTH_ALLOW_PASSKEY: Joi.boolean().truthy('true').falsy('false'),
  AUTH_ALLOW_SECURITY_KEY: Joi.boolean().truthy('true').falsy('false'),
  MTNAD_LOGIN_URL: Joi.string().uri().allow('').optional(),
  MTN_AD_LOGIN_URL: Joi.string().uri().allow('').optional(),

  // Bootstrap local administrator
  BOOTSTRAP_LOCAL_ADMIN: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  BOOTSTRAP_LOCAL_ADMIN_EMAIL: Joi.when('BOOTSTRAP_LOCAL_ADMIN', {
    is: true,
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().allow('').optional(),
  }),
  BOOTSTRAP_LOCAL_ADMIN_PASSWORD: Joi.when('BOOTSTRAP_LOCAL_ADMIN', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  BOOTSTRAP_LOCAL_ADMIN_PHONE: Joi.string().allow('').optional(),
  BOOTSTRAP_LOCAL_ADMIN_FIRST_NAME: Joi.string().allow('').optional(),
  BOOTSTRAP_LOCAL_ADMIN_LAST_NAME: Joi.string().allow('').optional(),
  BOOTSTRAP_LOCAL_ADMIN_RESET_PASSWORD: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  // MFA
  AUTH_MFA_ENABLED: Joi.boolean().truthy('true').falsy('false'),
  AUTH_MFA_ISSUER: Joi.string().default('Bulk Data Wholesale'),
  AUTH_MFA_TOTP_WINDOW: Joi.number().min(0).default(1),

  // Recovery Codes
  AUTH_RECOVERY_CODES_ENABLED: Joi.boolean().truthy('true').falsy('false'),
  AUTH_RECOVERY_CODES_COUNT: Joi.number().min(1).default(10),
  AUTH_RECOVERY_CODES_MIN_THRESHOLD: Joi.number().min(1).default(2),
  AUTH_RECOVERY_CODES_REQUIRE_REAUTH: Joi.boolean()
    .truthy('true')
    .falsy('false'),

  AUTH_RECOVERY_CODES_MAX_ATTEMPTS: Joi.number().min(1).default(5),
  AUTH_RECOVERY_CODES_ATTEMPT_WINDOW_SECONDS: Joi.number().min(1).default(900),
  AUTH_RECOVERY_CODES_LOCK_SECONDS: Joi.number().min(1).default(900),

  // Risk Engine
  AUTH_RISK_STEP_UP_THRESHOLD: Joi.number().min(0).default(4),
  AUTH_RISK_ENABLE_IP_VALIDATION: Joi.boolean().truthy('true').falsy('false'),
  AUTH_RISK_ENABLE_DEVICE_TRACKING: Joi.boolean().truthy('true').falsy('false'),
  AUTH_RISK_ENABLE_IMPOSSIBLE_TRAVEL: Joi.boolean()
    .truthy('true')
    .falsy('false'),
  AUTH_RISK_ENABLE_TIME_ANALYSIS: Joi.boolean().truthy('true').falsy('false'),

  // Sessions
  AUTH_SESSION_TTL_SECONDS: Joi.number().min(60).default(86400),
  AUTH_SESSION_IDLE_TIMEOUT_SECONDS: Joi.number().min(60).default(1800),
  AUTH_SESSION_ROTATION_ENABLED: Joi.boolean().truthy('true').falsy('false'),

  // Advanced Policies
  AUTH_DEVICE_TRUST_STRICT: Joi.boolean().truthy('true').falsy('false'),
  AUTH_BLOCK_ON_RECOVERY_POLICY_VIOLATION: Joi.boolean()
    .truthy('true')
    .falsy('false'),
  AUTH_FORCE_MFA_FOR_PRIVILEGED: Joi.boolean().truthy('true').falsy('false'),

  // WebAuthn
  WEBAUTHN_RP_ID: Joi.string().required(),
  WEBAUTHN_RP_NAME: Joi.string().required(),
  WEBAUTHN_ORIGIN: Joi.string().uri().required(),

  // OAuth
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri(),

  APPLE_CLIENT_ID: Joi.string().allow('').optional(),
  APPLE_TEAM_ID: Joi.string().allow('').optional(),
  APPLE_KEY_ID: Joi.string().allow('').optional(),
  APPLE_PRIVATE_KEY: Joi.string().allow('').optional(),
  APPLE_CALLBACK_URL: Joi.string().uri(),

  // Email
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false'),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SENDER_ADDRESS: Joi.string().required(),

  // SMS
  SMS_PROVIDER: Joi.string().default('africastalking'),
  AFRICASTALKING_USERNAME: Joi.string().allow('').optional(),
  AFRICASTALKING_APP: Joi.string().allow('').optional(),
  AFRICASTALKING_API_KEY: Joi.string().allow('').optional(),
  AFRICASTALKING_SENDER_ID: Joi.string().allow('').optional(),
  AFRICASTALKING_ENQUEUE: Joi.boolean().truthy('true').falsy('false'),

  // Firebase
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_ESMTP: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),

  // APN validation provider
  APN_PROVIDER_URL: Joi.string().uri().allow('').optional(),
  APN_PROVIDER_PARTNER_ID: Joi.string().allow('').optional(),
  APN_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  APN_PROVIDER_TIMEOUT_MS: Joi.number().min(1000).default(15000),
  APN_PROVIDER_TLS_REJECT_UNAUTHORIZED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // Provisioning provider adapter
  PROVISIONING_PROVIDER: Joi.string().valid('pcrf').default('pcrf'),
  PROVISIONING_PCRF_BASE_URL: Joi.string().uri().allow('').optional(),
  PROVISIONING_PCRF_TIMEOUT_MS: Joi.number().min(1000).default(15000),
  PROVISIONING_PCRF_BEARER_TOKEN: Joi.string().allow('').optional(),
  PROVISIONING_PCRF_API_KEY: Joi.string().allow('').optional(),
  PROVISIONING_PCRF_GROUP_MEMBER_PATH: Joi.string().default(
    '/api/pcrf/group-member',
  ),
  PROVISIONING_PCRF_GROUP_MEMBERS_BULK_PATH: Joi.string().default(
    '/api/pcrf/group-members/bulk',
  ),
  PROVISIONING_PCRF_GROUP_MEMBER_DELETE_PATH: Joi.string().default(
    '/api/pcrf/group-member/delete',
  ),
  PROVISIONING_PCRF_SUBSCRIPTIONS_UPDATE_PATH: Joi.string().default(
    '/api/pcrf/subscriptions/update',
  ),
  PROVISIONING_PCRF_SUBSCRIBER_PATH: Joi.string().default(
    '/api/pcrf/subscriber',
  ),
  PROVISIONING_PCRF_SUBSCRIBE_PATH: Joi.string().default('/api/pcrf/subscribe'),
  PROVISIONING_PCRF_SUBSCRIBE_URL: Joi.string().uri().allow('').optional(),

  // Backward-compatible aliases for existing deployment environments.
  PCRF_BASE_URL: Joi.string().uri().allow('').optional(),
  PCRF_TIMEOUT_MS: Joi.number().min(1000).optional(),
  PCRF_BEARER_TOKEN: Joi.string().allow('').optional(),
  PCRF_API_KEY: Joi.string().allow('').optional(),
  PCRF_GROUP_MEMBER_PATH: Joi.string().optional(),
  PCRF_GROUP_MEMBERS_BULK_PATH: Joi.string().optional(),
  PCRF_GROUP_MEMBER_DELETE_PATH: Joi.string().optional(),
  PCRF_SUBSCRIPTIONS_UPDATE_PATH: Joi.string().optional(),
  PCRF_SUBSCRIBER_PATH: Joi.string().optional(),
  PCRF_SUBSCRIBE_PATH: Joi.string().optional(),
  PCRF_SUBSCRIBE_URL: Joi.string().uri().allow('').optional(),

  // Payment provider
  SIMULATE_PAYMENT_STATUS_UPDATES: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  PAYMENT_PROVIDER_INIT_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  PAYMENT_PROVIDER_BEARER_TOKEN: Joi.string().allow('').optional(),
  PAYMENT_PROVIDER_TIMEOUT_MS: Joi.number().min(1000).default(15000),
  PAYMENT_PRN_PROVIDER_INIT_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_PRN_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  PAYMENT_PRN_PROVIDER_BEARER_TOKEN: Joi.string().allow('').optional(),
  PAYMENT_PRN_PROVIDER_TIMEOUT_MS: Joi.number().min(1000).optional(),
  PAYMENT_MOMO_PROVIDER_MODE: Joi.string()
    .valid('provider', 'sptransfer', 'sp_transfer')
    .default('provider'),
  PAYMENT_MOMO_PROVIDER_INIT_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_MOMO_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  PAYMENT_MOMO_PROVIDER_BEARER_TOKEN: Joi.string().allow('').optional(),
  PAYMENT_MOMO_PROVIDER_TIMEOUT_MS: Joi.number().min(1000).optional(),
  PAYMENT_MOMO_SPTRANSFER_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_MOMO_SPTRANSFER_BASE_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_MOMO_SPTRANSFER_PATH: Joi.string().default('/sptransfer/'),
  PAYMENT_MOMO_SPTRANSFER_FROM_FRI: Joi.string().allow('').optional(),
  PAYMENT_MOMO_SPTRANSFER_TO_FRI: Joi.string().allow('').optional(),
  PAYMENT_MOMO_SPTRANSFER_USERNAME: Joi.string().allow('').optional(),
  PAYMENT_MOMO_SPTRANSFER_PASSWORD: Joi.string().allow('').optional(),
  PAYMENT_AIRTIME_PROVIDER_INIT_URL: Joi.string().uri().allow('').optional(),
  PAYMENT_AIRTIME_UPDATE_BALANCE_PATH: Joi.string().default(
    '/api/update-balance-and-date',
  ),
  PAYMENT_AIRTIME_PROVIDER_API_KEY: Joi.string().allow('').optional(),
  PAYMENT_AIRTIME_PROVIDER_BEARER_TOKEN: Joi.string().allow('').optional(),
  PAYMENT_AIRTIME_PROVIDER_TIMEOUT_MS: Joi.number().min(1000).optional(),
  PAYMENT_CALLBACK_BASE_URL: Joi.string().uri().allow('').optional(),

  // Security
  SECURITY_AUDIT_LOG_ENABLED: Joi.boolean().truthy('true').falsy('false'),
  SECURITY_ALERT_ESMTP_ENABLED: Joi.boolean().truthy('true').falsy('false'),
  SECURITY_ALERT_SMS_ENABLED: Joi.boolean().truthy('true').falsy('false'),

  // Throttle
  THROTTLE_TTL: Joi.number().min(1).default(60000),
  THROTTLE_LIMIT: Joi.number().min(1).default(100),
  AUTH_THROTTLE_TTL: Joi.number().min(1).default(60000),
  AUTH_THROTTLE_LIMIT: Joi.number().min(1).default(5),
}).unknown(true);
