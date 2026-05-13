export enum NotificationType {
  // Auth & Account
  WELCOME = 'welcome',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_APPROVED = 'account_approved',
  ACCOUNT_REJECTED = 'account_rejected',

  // User
  USER_REGISTRATION_PENDING = 'user_registration_pending',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',

  USER_INVITED = 'user_invited',
  USER_CREDENTIALS = 'user_credentials',

  // Reports
  REPORT_READY = 'report_ready',
  WEEKLY_SUMMARY = 'weekly_summary',

  // System
  SYSTEM_ALERT = 'system_alert',
  DEVICE_LIMIT_WARNING = 'device_limit_warning',
}
