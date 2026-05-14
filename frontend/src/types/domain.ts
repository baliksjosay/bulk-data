export type CustomerStatus = "active" | "deactivated" | "pending";

export type PaymentMethod = "mobile_money" | "airtime" | "prn" | "card";

export type PrnPaymentProvider = "bank" | "mobile_money";

export type PaymentStatus =
  | "awaiting_payment"
  | "processing"
  | "confirmed"
  | "failed"
  | "expired";

export type BundleStatus = "active" | "paused" | "disabled";

export interface ApiValidationIssue {
  field?: string;
  message: string;
}

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  data: null;
  errors?: ApiValidationIssue[];
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export type AuthLoginMethod = "otp" | "password" | "passkey";

export type AuthRole = "admin" | "support" | "customer";
export type StaffUserRole = "ADMIN" | "SUPPORT";

export interface StaffUserCreateRequest {
  phoneNumber: string;
  email: string;
  lanId: string;
  role: StaffUserRole;
}

export interface UserAccount {
  id: string;
  firstName?: string;
  lastName?: string | null;
  email: string;
  phoneNumber?: string;
  authProvider: "LOCAL" | "GOOGLE" | "MICROSOFT" | "ACTIVE_DIRECTORY";
  externalId?: string;
  roles: Array<"SUPER_ADMIN" | "ADMIN" | "CUSTOMER" | "SUPPORT">;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LOCKED";
  emailVerified: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthLoginRequest {
  method: AuthLoginMethod;
  identifier?: string;
  identifierKind?: "phone" | "email" | "tin";
  otp?: string;
  email?: string;
  username?: string;
  phoneNumber?: string;
  password?: string;
  credentialId?: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  customerId?: string;
}

export interface PasswordlessSetupPrompt {
  title: string;
  message: string;
  setupUrl: string;
}

export interface AuthLoginResult {
  mfaRequired?: false;
  user: AuthenticatedUser;
  session: {
    id: string;
    expiresAt: string;
  };
  nextRoute: string;
  promptPasswordlessSetup: boolean;
  passwordlessSetupPrompt?: PasswordlessSetupPrompt;
}

export interface AuthMfaChallenge {
  mfaRequired: true;
  challengeToken?: string;
  challengeId?: string;
  mfaSelectionToken?: string;
  mfaMethod?: "totp" | "email-otp" | "sms-otp" | "webauthn" | "recovery-code";
  preferredMfaMethod?:
    | "totp"
    | "email-otp"
    | "sms-otp"
    | "webauthn"
    | "recovery-code";
  availableMfaMethods?: Array<
    "totp" | "email-otp" | "sms-otp" | "webauthn" | "recovery-code"
  >;
  mfaChallengeMetadata?: Record<string, unknown>;
  user: AuthenticatedUser;
  message?: string;
}

export type AuthLoginResponse = AuthLoginResult | AuthMfaChallenge;

export interface AccountActivationOtpRequest {
  token: string;
}

export interface AccountActivationOtpResult {
  activationId: string;
  maskedEmail: string;
  expiresAt: string;
  retryAfterSeconds: number;
}

export interface AccountActivationOtpVerificationRequest {
  token: string;
  activationId: string;
  otp: string;
}

export interface AccountActivationOtpVerificationResult {
  passwordSetupToken: string;
  expiresAt: string;
}

export interface AccountActivationPasswordRequest {
  passwordSetupToken: string;
  password: string;
  confirmPassword: string;
}

export type ProvisioningOperation =
  | "add_group_member"
  | "add_group_members_bulk"
  | "delete_group_member"
  | "update_subscription"
  | "add_subscriber"
  | "subscribe_service";

export interface ProvisioningGroupMemberPair {
  secondaryMsisdn: string;
  primaryMsisdn: string;
}

export interface ProvisioningAddGroupMembersBulkRequest {
  groupMembers: ProvisioningGroupMemberPair[];
}

export interface ProvisioningDeleteGroupMemberRequest {
  secondaryMsisdn: string;
}

export interface ProvisioningUpdateSubscriptionRequest {
  primaryMsisdn: string;
  serviceCode: string;
  transactionId: string;
  topupValue: number;
  updateAttemptCount: number;
}

export interface ProvisioningAddSubscriberRequest {
  msisdn: string;
  transactionId: string;
}

export interface ProvisioningCommandResult<TRequest> {
  requestId: string;
  operation: ProvisioningOperation;
  accepted: boolean;
  processedAt: string;
  providerStatusCode: number;
  request: TRequest;
  providerResponse: Record<string, unknown> | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedList<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Metric {
  label: string;
  value: string;
  trend: string;
  tone: "yellow" | "green" | "blue" | "red";
}

export type RevenueTrendPeriod =
  | "weekly"
  | "daily"
  | "quarterly"
  | "six_months"
  | "yearly"
  | "custom";

export interface OverviewQuery {
  revenuePeriod?: RevenueTrendPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface IntegrationHealth {
  name: string;
  status: "operational" | "degraded" | "offline";
  latencyMs: number;
  lastCheckedAt: string;
}

export interface OverviewAnalytics {
  revenueTrend: Array<{
    label: string;
    date: string;
    revenueUgx: number;
    purchases: number;
  }>;
  customerSpend: Array<{
    customerName: string;
    spendUgx: number;
    purchases: number;
    secondaryNumbers: number;
  }>;
  paymentMix: Array<{
    paymentMethod: PaymentMethod;
    revenueUgx: number;
    transactions: number;
  }>;
  statusBreakdown: Array<{
    status: Transaction["status"];
    revenueUgx: number;
    transactions: number;
  }>;
  integrationLatency: Array<{
    name: string;
    latencyMs: number;
    status: IntegrationHealth["status"];
  }>;
}

export interface Customer {
  id: string;
  businessName: string;
  registrationNumber: string;
  businessEmail: string;
  businessPhone: string;
  contactPerson: string;
  email: string;
  phone: string;
  apnName: string;
  apnId: string;
  primaryMsisdns: string[];
  secondaryCount: number;
  bundlePurchases: number;
  totalSpendUgx: number;
  status: CustomerStatus;
  deactivationReason?: string;
  createdAt: string;
}

export interface BundleOffer {
  id: string;
  serviceCode: string;
  name: string;
  volumeTb: number;
  priceUgx: number;
  validityDays: number;
  status: BundleStatus;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BundlePackageRequest {
  serviceCode: string;
  name: string;
  volumeTb: number;
  priceUgx: number;
  validityDays: number;
  status: BundleStatus;
  visible: boolean;
}

export type BundlePackageUpdateRequest = Partial<BundlePackageRequest>;

export interface Transaction {
  id: string;
  customerName: string;
  primaryMsisdn: string;
  bundleName: string;
  paymentMethod: PaymentMethod;
  amountUgx: number;
  status: "provisioned" | "pending" | "failed";
  createdAt: string;
}

export interface PaymentSession {
  id: string;
  transactionId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amountUgx: number;
  currency: "UGX";
  prn?: string;
  provider?: PrnPaymentProvider;
  providerTransactionId?: string;
  providerReference?: string;
  providerGeneratedAt?: string;
  paymentUrl?: string;
  socketEvent: string;
  socketRoom: string;
  expiresAt: string;
  createdAt: string;
  customerId: string;
  bundleId: string;
  provisioningCount: number;
}

export interface ReportTransaction extends Transaction {
  customerId: string;
  registrationNumber: string;
  apnId: string;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportTransactionQuery extends ListQuery {
  customerId?: string;
  paymentMethod?: PaymentMethod | "";
  status?: Transaction["status"] | "";
}

export interface Overview {
  metrics: Metric[];
  integrations: IntegrationHealth[];
  analytics: OverviewAnalytics;
  topCustomers: Customer[];
  recentTransactions: Transaction[];
}

export interface PurchaseRequest {
  customerId: string;
  primaryMsisdn: string;
  bundleId: string;
  provisioningCount: number;
  paymentMethod: PaymentMethod;
  payingMsisdn?: string;
  prnProvider?: PrnPaymentProvider;
  autoRenew?: boolean;
  redirectUrl?: string;
  additionalInfo?: string;
}

export interface PurchaseRetryRequest {
  paymentMethod?: PaymentMethod;
  payingMsisdn?: string;
  prnProvider?: PrnPaymentProvider;
  redirectUrl?: string;
  additionalInfo?: string;
}

export interface PurchaseResult {
  transaction: Transaction;
  paymentSession: PaymentSession;
}

export interface PurchaseConfirmationRequest {
  sessionId: string;
  status: Extract<PaymentStatus, "confirmed" | "failed">;
}

export interface PurchaseConfirmationResult {
  transaction: Transaction;
  paymentSession: PaymentSession;
  provisioningRequest: {
    subscribeService: boolean;
    modifySubSubscription: boolean;
    srvTopupCount: number;
    providerResult?: ProvisioningCommandResult<Record<string, unknown>>;
  };
}

export interface PaymentStatusEvent {
  sessionId: string;
  transactionId: string;
  status: PaymentStatus;
  message: string;
  provider?: PrnPaymentProvider;
  receiptNumber?: string;
  paidAt?: string;
}

export interface MsisdnValidationResult {
  msisdn: string;
  accepted: boolean;
  reason: string;
  apnIds: string[];
  registeredApnId: string;
  provisioningAction?:
    | "addSubscriber"
    | "addGroupMember"
    | "addMultipleGroupMember";
}

export interface CustomerRegistrationRequest {
  businessName: string;
  registrationNumber: string;
  businessEmail: string;
  businessPhone: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  apnName: string;
  apnId: string;
  primaryMsisdn: string;
}

export interface CustomerActivationNotice {
  activationToken: string;
  activationUrl: string;
  expiresAt: string;
  deliveryChannels: Array<"business_email" | "contact_email">;
}

export interface CustomerRegistrationResult {
  customer: Customer;
  validation: MsisdnValidationResult;
  activation: CustomerActivationNotice;
}

export interface CustomerUpdateRequest {
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  apnName?: string;
  apnId?: string;
}

export interface CustomerStatusChangeRequest {
  status: "active" | "deactivated";
  reason: string;
  supportingNote?: string;
}

export interface ServiceRequestRequest {
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  preferredPackageId?: string;
  message?: string;
}

export type ServiceRequestStatus = "new" | "contacted" | "converted";

export interface ServiceRequest {
  id: string;
  businessName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  preferredPackageId?: string;
  preferredPackageName?: string;
  message?: string;
  status: ServiceRequestStatus;
  createdAt: string;
}

export interface ServiceRequestUpdateRequest {
  status: Exclude<ServiceRequestStatus, "converted">;
  note?: string;
}

export type ServiceRequestConversionRequest = CustomerRegistrationRequest;

export interface ServiceRequestConversionResult {
  serviceRequest: ServiceRequest;
  customer: Customer;
  validation: MsisdnValidationResult;
}

export interface PrimaryMsisdnRequest {
  primaryMsisdn: string;
}

export interface SecondaryNumber {
  id: string;
  customerId: string;
  primaryMsisdn: string;
  msisdn: string;
  apnId: string;
  status: "active" | "removed";
  addedAt: string;
}

export interface SecondaryUsageResult {
  customerId: string;
  primaryMsisdn: string;
  secondaryMsisdn: string;
  bundleName: string;
  allocatedVolumeGb: number;
  usedVolumeGb: number;
  remainingVolumeGb: number;
  usagePercent: number;
  lastUsedAt: string;
  status: SecondaryNumber["status"];
}

export interface SecondaryNumberRequest {
  msisdn: string;
}

export interface SecondaryBulkRequest {
  msisdns: string[];
}

export interface SecondaryBulkResult {
  added: SecondaryNumber[];
  rejected: MsisdnValidationResult[];
}

export interface BalanceResult {
  primaryMsisdn: string;
  bundleName: string;
  totalVolumeGb: number;
  remainingVolumeGb: number;
  expiryAt: string;
  autoTopupRemaining: number;
}

export interface AdminReport {
  transactions: Transaction[];
  customerActivity: Array<{
    customerId: string;
    customerName: string;
    createdAt: string;
    totalPrimaryNumbers: number;
    totalSecondaryNumbers: number;
    bundlesPurchased: number;
    totalSpendUgx: number;
    status: CustomerStatus;
  }>;
}

export interface CustomerReport {
  customerId: string;
  bundlePurchaseHistory: Transaction[];
  secondaryNumbers: SecondaryNumber[];
  balances: BalanceResult[];
}

export interface MfaService {
  id: "totp" | "email_otp" | "sms_otp" | "webauthn" | "recovery_codes";
  label: string;
  enabled: boolean;
  requiredForAdmins: boolean;
  requiredForCustomers: boolean;
  lastUpdatedAt: string;
}

export interface MfaConfiguration {
  services: MfaService[];
  trustedDeviceDays: number;
  stepUpForBundlePurchases: boolean;
  stepUpForSecondaryNumberChanges: boolean;
}

export interface TotpAuthenticatorApp {
  id: string;
  label: string;
  issuer: string;
  accountName: string;
  createdAt: string;
  lastUsedAt?: string;
  status: "active" | "revoked";
}

export interface TotpEnrollmentRequest {
  label: string;
}

export interface TotpEnrollment {
  id: string;
  label: string;
  secret: string;
  otpauthUrl: string;
  issuer: string;
  accountName: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
  expiresAt: string;
}

export interface TotpVerificationRequest {
  enrollmentId: string;
  code: string;
}

export interface TotpVerificationResult {
  enabled: boolean;
  app: TotpAuthenticatorApp;
  recoveryCodes: string[];
  verifiedAt: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "en" | "lug";
  timezone: string;
  defaultLanding: "overview" | "admin" | "customer" | "security";
  dataDensity: "comfortable" | "compact";
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    inApp: boolean;
  };
}

export type NotificationType =
  | "welcome"
  | "email_verification"
  | "password_reset"
  | "account_approved"
  | "account_rejected"
  | "user_registration_pending"
  | "user_activated"
  | "user_deactivated"
  | "user_invited"
  | "user_credentials"
  | "report_ready"
  | "weekly_summary"
  | "system_alert"
  | "device_limit_warning";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationStatus =
  | "pending"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled";

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  subject?: string | null;
  body: string;
  data?: Record<string, unknown> | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface InAppNotification {
  id: string;
  notificationId: string;
  userId: string;
  email?: string | null;
  phoneNumber?: string | null;
  isRead: boolean;
  status: NotificationStatus;
  readAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  notification: NotificationRecord;
}

export interface NotificationListResult {
  data: InAppNotification[];
  total: number;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface NotificationReadResult {
  updated: number;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: "public-key";
    alg: number;
  }>;
  timeout: number;
  authenticatorSelection: {
    residentKey: ResidentKeyRequirement;
    userVerification: UserVerificationRequirement;
  };
  attestation: AttestationConveyancePreference;
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{
    id: string;
    type: "public-key";
    transports?: AuthenticatorTransport[];
  }>;
  userVerification?: UserVerificationRequirement;
}

export interface WebAuthnDevice {
  id: string;
  label: string;
  credentialId: string;
  transports: AuthenticatorTransport[];
  createdAt: string;
  lastUsedAt: string;
  status: "active" | "revoked";
}

export interface AuthSession {
  id: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
  status: "active" | "revoked";
}

export interface AuditEvent {
  id: string;
  category: "security" | "customer" | "bundle" | "integration";
  action: string;
  actor: string;
  outcome: "success" | "warning" | "failed";
  createdAt: string;
}
