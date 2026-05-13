export const UGANDA_MTN_E164_PATTERN = /^\+256(77|78|79|76|39)\d{7}$/;

export enum CustomerStatus {
  ACTIVE = 'active',
  DEACTIVATED = 'deactivated',
  PENDING = 'pending',
}

export enum BundleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
}

export enum PaymentMethod {
  MOBILE_MONEY = 'mobile_money',
  AIRTIME = 'airtime',
  PRN = 'prn',
  CARD = 'card',
}

export enum PrnPaymentProvider {
  BANK = 'bank',
  MOBILE_MONEY = 'mobile_money',
}

export enum PaymentSessionStatus {
  AWAITING_PAYMENT = 'awaiting_payment',
  PROCESSING = 'processing',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum TransactionStatus {
  PROVISIONED = 'provisioned',
  PENDING = 'pending',
  FAILED = 'failed',
}

export enum ServiceRequestStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
}

export enum RevenueTrendPeriod {
  WEEKLY = 'weekly',
  DAILY = 'daily',
  QUARTERLY = 'quarterly',
  SIX_MONTHS = 'six_months',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}
