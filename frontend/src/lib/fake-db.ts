import QRCode from "qrcode";
import { UGANDA_PHONE_PATTERN, UGANDA_PHONE_TITLE } from "@/lib/uganda-phone";
import type {
  AuthSession,
  AuditEvent,
  BalanceResult,
  BundleOffer,
  BundlePackageRequest,
  BundlePackageUpdateRequest,
  Customer,
  CustomerActivationNotice,
  CustomerRegistrationRequest,
  CustomerStatusChangeRequest,
  CustomerUpdateRequest,
  IntegrationHealth,
  InAppNotification,
  MsisdnValidationResult,
  MfaConfiguration,
  PrimaryMsisdnRequest,
  PaymentSession,
  ReportTransaction,
  SecondaryBulkRequest,
  SecondaryBulkResult,
  SecondaryNumber,
  SecondaryNumberRequest,
  SecondaryUsageResult,
  ServiceRequest,
  ServiceRequestConversionRequest,
  ServiceRequestRequest,
  ServiceRequestUpdateRequest,
  TotpAuthenticatorApp,
  TotpEnrollment,
  TotpVerificationResult,
  Transaction,
  UserPreferences,
  WebAuthnDevice,
} from "@/types/domain";

const now = new Date("2026-04-21T09:00:00+03:00").toISOString();
const bundleCreatedAt = "2026-04-15T09:00:00+03:00";
const activationOtpCode = "123456";

type AccountActivationRecord = {
  token: string;
  customerId: string;
  expiresAt: string;
};

type AccountActivationOtpRecord = AccountActivationRecord & {
  activationId: string;
  otp: string;
};

type AccountActivationPasswordRecord = AccountActivationRecord & {
  passwordSetupToken: string;
};

export const customers: Customer[] = [
  {
    id: "cus-baliksjosay",
    businessName: "Baliks Josay",
    registrationNumber: "1000172796",
    businessEmail: "baliksjosay@gmail.com",
    businessPhone: "+256789172796",
    contactPerson: "Baliks Josay",
    email: "baliksjosay@gmail.com",
    phone: "+256789172796",
    apnName: "baliksjosay.mtn.ug",
    apnId: "APN-172796",
    primaryMsisdns: ["+256789172796"],
    secondaryCount: 0,
    bundlePurchases: 0,
    totalSpendUgx: 0,
    status: "active",
    createdAt: "2026-04-21T11:00:00+03:00",
  },
  {
    id: "cus-wavenet",
    businessName: "WaveNet",
    registrationNumber: "1000004829",
    businessEmail: "business@wavenet.ug",
    businessPhone: "+256772100200",
    contactPerson: "Sarah Namuli",
    email: "operations@wavenet.ug",
    phone: "+256772100201",
    apnName: "wavenet.mtn.ug",
    apnId: "APN-1092",
    primaryMsisdns: ["+256772990001", "+256772990002"],
    secondaryCount: 430,
    bundlePurchases: 350,
    totalSpendUgx: 18500000,
    status: "active",
    createdAt: "2026-04-18T09:00:00+03:00",
  },
  {
    id: "cus-skyconnect",
    businessName: "SkyConnect",
    registrationNumber: "1000005631",
    businessEmail: "business@skyconnect.ug",
    businessPhone: "+256782430900",
    contactPerson: "Daniel Kato",
    email: "admin@skyconnect.ug",
    phone: "+256782430911",
    apnName: "skyconnect.mtn.ug",
    apnId: "APN-1177",
    primaryMsisdns: ["+256772990101"],
    secondaryCount: 210,
    bundlePurchases: 190,
    totalSpendUgx: 9750000,
    status: "active",
    createdAt: "2026-04-19T10:15:00+03:00",
  },
  {
    id: "cus-metroisp",
    businessName: "MetroISP",
    registrationNumber: "1000007710",
    businessEmail: "business@metroisp.ug",
    businessPhone: "+256783440100",
    contactPerson: "Miriam Akello",
    email: "support@metroisp.ug",
    phone: "+256783440120",
    apnName: "metroisp.mtn.ug",
    apnId: "APN-1342",
    primaryMsisdns: ["+256772990211"],
    secondaryCount: 120,
    bundlePurchases: 92,
    totalSpendUgx: 4300000,
    status: "pending",
    createdAt: "2026-04-20T13:20:00+03:00",
  },
];

export const bundles: BundleOffer[] = [
  {
    id: "bundle-500gb",
    serviceCode: "BDS-500G-30D",
    name: "Wholesale 500 GB",
    volumeTb: 0.5,
    priceUgx: 1250000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-1tb",
    serviceCode: "BDS-1T-30D",
    name: "Wholesale 1 TB",
    volumeTb: 1,
    priceUgx: 2300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-2tb",
    serviceCode: "BDS-2T-30D",
    name: "Wholesale 2 TB",
    volumeTb: 2,
    priceUgx: 4300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-4tb",
    serviceCode: "BDS-4T-30D",
    name: "Wholesale 4 TB",
    volumeTb: 4,
    priceUgx: 8000000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-250gb",
    serviceCode: "BDS-250G-30D",
    name: "Wholesale 250 GB",
    volumeTb: 0.25,
    priceUgx: 650000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-750gb",
    serviceCode: "BDS-750G-30D",
    name: "Wholesale 750 GB",
    volumeTb: 0.75,
    priceUgx: 1800000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-1p5tb",
    serviceCode: "BDS-1P5T-30D",
    name: "Wholesale 1.5 TB",
    volumeTb: 1.5,
    priceUgx: 3300000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
  {
    id: "bundle-3tb",
    serviceCode: "BDS-3T-30D",
    name: "Wholesale 3 TB",
    volumeTb: 3,
    priceUgx: 6100000,
    validityDays: 30,
    status: "active",
    visible: true,
    createdAt: bundleCreatedAt,
    updatedAt: now,
  },
];

export const integrations: IntegrationHealth[] = [
  {
    name: "Network Provisioning",
    status: "operational",
    latencyMs: 118,
    lastCheckedAt: now,
  },
  {
    name: "Service Validation",
    status: "operational",
    latencyMs: 92,
    lastCheckedAt: now,
  },
  {
    name: "Subscriber Directory",
    status: "degraded",
    latencyMs: 411,
    lastCheckedAt: now,
  },
  {
    name: "Payments Gateway",
    status: "operational",
    latencyMs: 156,
    lastCheckedAt: now,
  },
];

const baseTransactions: Transaction[] = [
  {
    id: "txn-1005",
    customerName: "WaveNet",
    primaryMsisdn: "+256772990001",
    bundleName: "Wholesale 2 TB",
    paymentMethod: "mobile_money",
    amountUgx: 4300000,
    status: "provisioned",
    createdAt: "2026-04-21T08:42:00+03:00",
  },
  {
    id: "txn-1004",
    customerName: "SkyConnect",
    primaryMsisdn: "+256772990101",
    bundleName: "Wholesale 1 TB",
    paymentMethod: "card",
    amountUgx: 2300000,
    status: "provisioned",
    createdAt: "2026-04-21T07:18:00+03:00",
  },
  {
    id: "txn-1003",
    customerName: "MetroISP",
    primaryMsisdn: "+256772990211",
    bundleName: "Wholesale 500 GB",
    paymentMethod: "prn",
    amountUgx: 1250000,
    status: "pending",
    createdAt: "2026-04-20T17:03:00+03:00",
  },
];

const generatedTransactions: Transaction[] = Array.from(
  { length: 72 },
  (_, index) => {
    const customer = customers[index % customers.length];
    const bundle = bundles[(index + 1) % bundles.length];
    const paymentMethods: Transaction["paymentMethod"][] = [
      "mobile_money",
      "airtime",
      "prn",
      "card",
    ];
    const statuses: Transaction["status"][] = [
      "provisioned",
      "provisioned",
      "pending",
      "failed",
    ];
    const createdAt = new Date("2026-04-21T09:00:00+03:00");

    createdAt.setDate(createdAt.getDate() - ((index + 1) % 48));
    createdAt.setHours(8 + (index % 10), (index * 7) % 60, 0, 0);

    return {
      id: `txn-${2000 + index}`,
      customerName: customer.businessName,
      primaryMsisdn:
        customer.primaryMsisdns[index % customer.primaryMsisdns.length],
      bundleName: bundle.name,
      paymentMethod: paymentMethods[index % paymentMethods.length],
      amountUgx: bundle.priceUgx,
      status: statuses[index % statuses.length],
      createdAt: createdAt.toISOString(),
    };
  },
);

export const transactions: Transaction[] = [
  ...baseTransactions,
  ...generatedTransactions,
].sort(
  (left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
);

export const paymentSessions: PaymentSession[] = [];
const accountActivationRecords: AccountActivationRecord[] = [];
const accountActivationOtps: AccountActivationOtpRecord[] = [];
const accountActivationPasswordTokens: AccountActivationPasswordRecord[] = [];

export const serviceRequests: ServiceRequest[] = [
  {
    id: "srv-1001",
    businessName: "Kampala Fiber Hub",
    contactPerson: "Grace Nansubuga",
    contactEmail: "operations@kampalafiber.ug",
    contactPhone: "+256772441120",
    preferredPackageId: "bundle-1tb",
    preferredPackageName: "Wholesale 1 TB",
    message: "We need data pooling for branch routers and field teams.",
    status: "new",
    createdAt: "2026-04-21T10:30:00+03:00",
  },
  {
    id: "srv-1002",
    businessName: "Pearl Logistics",
    contactPerson: "Ivan Okello",
    contactEmail: "it@pearllogistics.ug",
    contactPhone: "+256782441121",
    preferredPackageId: "bundle-500gb",
    preferredPackageName: "Wholesale 500 GB",
    message: "We are evaluating bulk data for fleet tablets.",
    status: "contacted",
    createdAt: "2026-04-20T15:10:00+03:00",
  },
];

export const secondaryNumbers: SecondaryNumber[] = [
  {
    id: "sec-1",
    customerId: "cus-wavenet",
    primaryMsisdn: "+256772990001",
    msisdn: "+256772991001",
    apnId: "APN-1092",
    status: "active",
    addedAt: "2026-04-20T09:00:00+03:00",
  },
  {
    id: "sec-2",
    customerId: "cus-wavenet",
    primaryMsisdn: "+256772990001",
    msisdn: "+256772991002",
    apnId: "APN-1092",
    status: "active",
    addedAt: "2026-04-20T09:02:00+03:00",
  },
  {
    id: "sec-3",
    customerId: "cus-skyconnect",
    primaryMsisdn: "+256772990101",
    msisdn: "+256772991101",
    apnId: "APN-1177",
    status: "active",
    addedAt: "2026-04-21T07:05:00+03:00",
  },
];

export const balances: BalanceResult[] = [
  {
    primaryMsisdn: "+256789172796",
    bundleName: "No active bundle",
    totalVolumeGb: 0,
    remainingVolumeGb: 0,
    expiryAt: "2026-05-21T23:59:59+03:00",
    autoTopupRemaining: 0,
  },
  {
    primaryMsisdn: "+256772990001",
    bundleName: "Wholesale 2 TB",
    totalVolumeGb: 2048,
    remainingVolumeGb: 1286,
    expiryAt: "2026-05-20T23:59:59+03:00",
    autoTopupRemaining: 2,
  },
  {
    primaryMsisdn: "+256772990002",
    bundleName: "Wholesale 1 TB",
    totalVolumeGb: 1024,
    remainingVolumeGb: 904,
    expiryAt: "2026-05-19T23:59:59+03:00",
    autoTopupRemaining: 0,
  },
  {
    primaryMsisdn: "+256772990101",
    bundleName: "Wholesale 1 TB",
    totalVolumeGb: 1024,
    remainingVolumeGb: 412,
    expiryAt: "2026-05-18T23:59:59+03:00",
    autoTopupRemaining: 1,
  },
  {
    primaryMsisdn: "+256772990211",
    bundleName: "Wholesale 500 GB",
    totalVolumeGb: 500,
    remainingVolumeGb: 500,
    expiryAt: "2026-05-20T23:59:59+03:00",
    autoTopupRemaining: 0,
  },
];

export let mfaConfiguration: MfaConfiguration = {
  services: [
    {
      id: "totp",
      label: "Authenticator app",
      enabled: true,
      requiredForAdmins: true,
      requiredForCustomers: false,
      lastUpdatedAt: now,
    },
    {
      id: "email_otp",
      label: "Email OTP",
      enabled: true,
      requiredForAdmins: false,
      requiredForCustomers: true,
      lastUpdatedAt: now,
    },
    {
      id: "sms_otp",
      label: "SMS OTP",
      enabled: true,
      requiredForAdmins: false,
      requiredForCustomers: false,
      lastUpdatedAt: now,
    },
    {
      id: "webauthn",
      label: "Passkeys",
      enabled: true,
      requiredForAdmins: true,
      requiredForCustomers: false,
      lastUpdatedAt: now,
    },
    {
      id: "recovery_codes",
      label: "Recovery codes",
      enabled: true,
      requiredForAdmins: true,
      requiredForCustomers: true,
      lastUpdatedAt: now,
    },
  ],
  trustedDeviceDays: 14,
  stepUpForBundlePurchases: true,
  stepUpForSecondaryNumberChanges: true,
};

export let preferences: UserPreferences = {
  theme: "light",
  language: "en",
  timezone: "Africa/Kampala",
  defaultLanding: "overview",
  dataDensity: "comfortable",
  quietHours: {
    enabled: true,
    start: "20:00",
    end: "07:00",
  },
  notifications: {
    email: true,
    sms: true,
    whatsapp: false,
    inApp: true,
  },
};

export const webAuthnDevices: WebAuthnDevice[] = [
  {
    id: "passkey-1",
    label: "Operations laptop",
    credentialId: "credential-ops-laptop",
    transports: ["internal"],
    createdAt: "2026-04-18T11:30:00+03:00",
    lastUsedAt: "2026-04-21T08:12:00+03:00",
    status: "active",
  },
];

export const authSessions: AuthSession[] = [
  {
    id: "sess-current",
    device: "MacBook Pro",
    browser: "Chrome 125",
    ipAddress: "196.43.183.20",
    location: "Kampala, Uganda",
    createdAt: "2026-04-21T07:45:00+03:00",
    lastActiveAt: "2026-04-21T08:59:00+03:00",
    current: true,
    status: "active",
  },
  {
    id: "sess-admin-phone",
    device: "iPhone 15",
    browser: "Safari Mobile",
    ipAddress: "196.43.183.44",
    location: "Kampala, Uganda",
    createdAt: "2026-04-20T16:18:00+03:00",
    lastActiveAt: "2026-04-21T08:05:00+03:00",
    current: false,
    status: "active",
  },
  {
    id: "sess-support-tablet",
    device: "Samsung Galaxy Tab",
    browser: "Edge Mobile",
    ipAddress: "41.210.141.18",
    location: "Entebbe, Uganda",
    createdAt: "2026-04-18T11:02:00+03:00",
    lastActiveAt: "2026-04-20T18:30:00+03:00",
    current: false,
    status: "active",
  },
];

export const inAppNotifications: InAppNotification[] = [
  {
    id: "notif-recipient-1001",
    notificationId: "notif-1001",
    userId: "demo-user",
    isRead: false,
    status: "delivered",
    readAt: null,
    createdAt: "2026-04-21T08:48:00+03:00",
    notification: {
      id: "notif-1001",
      type: "system_alert",
      status: "delivered",
      priority: "high",
      subject: "Provisioning queue delayed",
      body: "Network Provisioning latency is above the normal operating threshold.",
      actionUrl: "/console?section=overview",
      actionLabel: "Open overview",
      createdAt: "2026-04-21T08:48:00+03:00",
    },
  },
  {
    id: "notif-recipient-1002",
    notificationId: "notif-1002",
    userId: "demo-user",
    isRead: false,
    status: "delivered",
    readAt: null,
    createdAt: "2026-04-21T08:25:00+03:00",
    notification: {
      id: "notif-1002",
      type: "report_ready",
      status: "delivered",
      priority: "normal",
      subject: "Transaction report ready",
      body: "The latest bundle purchase and provisioning report is available.",
      actionUrl: "/console?section=report-transactions",
      actionLabel: "View report",
      createdAt: "2026-04-21T08:25:00+03:00",
    },
  },
  {
    id: "notif-recipient-1003",
    notificationId: "notif-1003",
    userId: "demo-user",
    isRead: true,
    status: "read",
    readAt: "2026-04-21T08:05:00+03:00",
    createdAt: "2026-04-21T07:52:00+03:00",
    notification: {
      id: "notif-1003",
      type: "weekly_summary",
      status: "delivered",
      priority: "low",
      subject: "Weekly summary",
      body: "Customer activity and secondary number changes have been summarized.",
      actionUrl: "/console?section=report-customer-activity",
      actionLabel: "Open summary",
      createdAt: "2026-04-21T07:52:00+03:00",
    },
  },
];

export function markInAppNotificationsRead(notificationIds: string[]) {
  const nowIso = new Date().toISOString();
  let updated = 0;

  inAppNotifications.forEach((notification) => {
    if (
      notificationIds.includes(notification.notificationId) ||
      notificationIds.includes(notification.id)
    ) {
      if (!notification.isRead) {
        updated += 1;
      }

      notification.isRead = true;
      notification.status = "read";
      notification.readAt = nowIso;
      notification.updatedAt = nowIso;
    }
  });

  return { updated };
}

export function markAllInAppNotificationsRead() {
  const unreadNotificationIds = inAppNotifications
    .filter((notification) => !notification.isRead)
    .map((notification) => notification.notificationId);

  return markInAppNotificationsRead(unreadNotificationIds);
}

export const auditEvents: AuditEvent[] = [
  {
    id: "aud-1001",
    category: "security",
    action: "MFA policy updated",
    actor: "Racheal Kawudha",
    outcome: "success",
    createdAt: "2026-04-21T08:45:00+03:00",
  },
  {
    id: "aud-1000",
    category: "integration",
    action: "Subscriber service latency threshold breached",
    actor: "System",
    outcome: "warning",
    createdAt: "2026-04-21T08:32:00+03:00",
  },
];

export function setMfaConfiguration(nextConfiguration: MfaConfiguration) {
  mfaConfiguration = nextConfiguration;
}

export function setPreferences(nextPreferences: UserPreferences) {
  preferences = nextPreferences;
}

export function addAuditEvent(event: Omit<AuditEvent, "id" | "createdAt">) {
  auditEvents.unshift({
    ...event,
    id: `aud-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  });
}

export const totpAuthenticatorApps: TotpAuthenticatorApp[] = [
  {
    id: "totp-app-ops",
    label: "Operations Authenticator",
    issuer: "MTN Bulk Data Wholesale",
    accountName: "security.admin@mtn.co.ug",
    createdAt: "2026-04-19T10:24:00+03:00",
    lastUsedAt: "2026-04-21T08:30:00+03:00",
    status: "active",
  },
];

const activeTotpEnrollments: TotpEnrollment[] = [];

function randomToken(alphabet: string, length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function createRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const first = randomToken("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);
    const second = randomToken("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

    return `BDS-${first}-${second}`;
  });
}

export async function startTotpEnrollment(label = "Authenticator app") {
  const secret = randomToken("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", 32);
  const issuer = "MTN Bulk Data Wholesale";
  const accountName = "security.admin@mtn.co.ug";
  const otpauthParams = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });

  const otpauthUrl = `otpauth://totp/${encodeURIComponent(`${issuer}:${accountName}`)}?${otpauthParams.toString()}`;
  const enrollment: TotpEnrollment = {
    id: `totp-enroll-${Math.random().toString(36).slice(2, 9)}`,
    label: label.trim() || "Authenticator app",
    secret,
    otpauthUrl,
    issuer,
    accountName,
    qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
    }),
    recoveryCodes: createRecoveryCodes(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  activeTotpEnrollments.unshift(enrollment);
  addAuditEvent({
    category: "security",
    action: "Authenticator app enrollment started",
    actor: "Current user",
    outcome: "success",
  });

  return enrollment;
}

export function verifyTotpEnrollment(
  enrollmentId: string,
  code: string,
): TotpVerificationResult | null {
  const enrollmentIndex = activeTotpEnrollments.findIndex(
    (item) => item.id === enrollmentId,
  );
  const enrollment = activeTotpEnrollments[enrollmentIndex];

  if (
    !enrollment ||
    !/^\d{6}$/.test(code) ||
    new Date(enrollment.expiresAt).getTime() < Date.now()
  ) {
    return null;
  }

  const verifiedAt = new Date().toISOString();
  const app: TotpAuthenticatorApp = {
    id: `totp-app-${Math.random().toString(36).slice(2, 9)}`,
    label: enrollment.label,
    issuer: enrollment.issuer,
    accountName: enrollment.accountName,
    createdAt: verifiedAt,
    lastUsedAt: verifiedAt,
    status: "active",
  };

  totpAuthenticatorApps.unshift(app);
  mfaConfiguration = {
    ...mfaConfiguration,
    services: mfaConfiguration.services.map((service) =>
      service.id === "totp"
        ? {
            ...service,
            enabled: true,
            lastUpdatedAt: verifiedAt,
          }
        : service,
    ),
  };

  const result: TotpVerificationResult = {
    enabled: true,
    app,
    recoveryCodes: enrollment.recoveryCodes,
    verifiedAt,
  };

  activeTotpEnrollments.splice(enrollmentIndex, 1);
  addAuditEvent({
    category: "security",
    action: "Authenticator app enrolled",
    actor: "Current user",
    outcome: "success",
  });

  return result;
}

export function revokeAuthSession(sessionId: string) {
  const session = authSessions.find((item) => item.id === sessionId);

  if (!session || session.current) {
    return null;
  }

  session.status = "revoked";
  addAuditEvent({
    category: "security",
    action: "User session revoked",
    actor: "Current user",
    outcome: "success",
  });

  return session;
}

function normalizeBundleServiceCode(serviceCode: string) {
  return serviceCode.trim().toUpperCase();
}

function createActivationExpiry(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeActivationToken(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function createAccountActivationNotice(
  customer: Customer,
): CustomerActivationNotice {
  const activationToken = makeActivationToken("act");
  const expiresAt = createActivationExpiry();

  accountActivationRecords.unshift({
    token: activationToken,
    customerId: customer.id,
    expiresAt,
  });

  return {
    activationToken,
    activationUrl: `/auth/activate?token=${encodeURIComponent(activationToken)}`,
    expiresAt,
    deliveryChannels: ["business_email", "contact_email"],
  };
}

export function getAccountActivationRecord(token: string) {
  const record = accountActivationRecords.find((item) => item.token === token);

  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return record;
}

export function createAccountActivationOtp(token: string, email: string) {
  const record = getAccountActivationRecord(token);

  if (!record) {
    return null;
  }

  const activationId = makeActivationToken("otp");
  const expiresAt = createActivationExpiry(10 / 60);

  accountActivationOtps.unshift({
    ...record,
    activationId,
    otp: activationOtpCode,
    expiresAt,
  });

  addAuditEvent({
    category: "security",
    action: "Activation OTP issued",
    actor: email,
    outcome: "success",
  });

  return {
    activationId,
    maskedEmail: maskEmail(email),
    expiresAt,
    retryAfterSeconds: 60,
  };
}

export function verifyAccountActivationOtp(
  token: string,
  activationId: string,
  otp: string,
) {
  const otpIndex = accountActivationOtps.findIndex(
    (item) => item.token === token && item.activationId === activationId,
  );
  const otpRecord = accountActivationOtps[otpIndex];

  if (
    !otpRecord ||
    otpRecord.otp !== otp ||
    new Date(otpRecord.expiresAt).getTime() < Date.now()
  ) {
    return null;
  }

  accountActivationOtps.splice(otpIndex, 1);

  const passwordSetupToken = makeActivationToken("pwd");
  const expiresAt = createActivationExpiry(1);

  accountActivationPasswordTokens.unshift({
    token,
    passwordSetupToken,
    customerId: otpRecord.customerId,
    expiresAt,
  });

  return {
    passwordSetupToken,
    expiresAt,
  };
}

export function consumeAccountActivationPasswordToken(
  passwordSetupToken: string,
) {
  const tokenIndex = accountActivationPasswordTokens.findIndex(
    (item) => item.passwordSetupToken === passwordSetupToken,
  );
  const record = accountActivationPasswordTokens[tokenIndex];

  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }

  accountActivationPasswordTokens.splice(tokenIndex, 1);

  return record;
}

export function createBundlePackage(payload: BundlePackageRequest) {
  const serviceCode = normalizeBundleServiceCode(payload.serviceCode);

  if (bundles.some((bundle) => bundle.serviceCode === serviceCode)) {
    return null;
  }

  const bundle: BundleOffer = {
    id: `bundle-${Math.random().toString(36).slice(2, 9)}`,
    serviceCode,
    name: payload.name.trim(),
    volumeTb: payload.volumeTb,
    priceUgx: payload.priceUgx,
    validityDays: 30,
    status: payload.status,
    visible: payload.visible,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bundles.unshift(bundle);
  addAuditEvent({
    category: "bundle",
    action: "Bundle package created",
    actor: "Security Admin",
    outcome: "success",
  });

  return bundle;
}

export function updateBundlePackage(
  bundleId: string,
  payload: BundlePackageUpdateRequest,
) {
  const bundle = bundles.find((item) => item.id === bundleId);

  if (!bundle) {
    return undefined;
  }

  const serviceCode = payload.serviceCode
    ? normalizeBundleServiceCode(payload.serviceCode)
    : bundle.serviceCode;

  if (
    bundles.some(
      (item) => item.id !== bundleId && item.serviceCode === serviceCode,
    )
  ) {
    return null;
  }

  Object.assign(bundle, {
    serviceCode,
    name: payload.name?.trim() ?? bundle.name,
    volumeTb: payload.volumeTb ?? bundle.volumeTb,
    priceUgx: payload.priceUgx ?? bundle.priceUgx,
    validityDays: payload.validityDays ?? bundle.validityDays,
    status: payload.status ?? bundle.status,
    visible: payload.visible ?? bundle.visible,
    updatedAt: new Date().toISOString(),
  });
  addAuditEvent({
    category: "bundle",
    action: "Bundle package updated",
    actor: "Security Admin",
    outcome: "success",
  });

  return bundle;
}

export function getReportTransactionRows(): ReportTransaction[] {
  return transactions.map((transaction) => {
    const customer = customers.find(
      (item) => item.businessName === transaction.customerName,
    );

    return {
      ...transaction,
      customerId: customer?.id ?? "unknown",
      registrationNumber: customer?.registrationNumber ?? "Unknown",
      apnId: customer?.apnId ?? "Unknown",
    };
  });
}

export function validateMsisdnForCustomer(
  msisdn: string,
  customer: Pick<Customer, "apnId">,
  provisioningAction?: MsisdnValidationResult["provisioningAction"],
): MsisdnValidationResult {
  if (!UGANDA_PHONE_PATTERN.test(msisdn)) {
    return {
      msisdn,
      accepted: false,
      reason: UGANDA_PHONE_TITLE,
      apnIds: [],
      registeredApnId: customer.apnId,
    };
  }

  if (msisdn.endsWith("999")) {
    return {
      msisdn,
      accepted: false,
      reason: "MSISDN has more than one APN attached",
      apnIds: [customer.apnId, "APN-ALT"],
      registeredApnId: customer.apnId,
    };
  }

  if (msisdn.endsWith("888")) {
    return {
      msisdn,
      accepted: false,
      reason: "MSISDN APN differs from the registered customer APN",
      apnIds: ["APN-DIFFERENT"],
      registeredApnId: customer.apnId,
    };
  }

  return {
    msisdn,
    accepted: true,
    reason: "MSISDN APN validation passed",
    apnIds: [customer.apnId],
    registeredApnId: customer.apnId,
    provisioningAction,
  };
}

export function registerCustomer(payload: CustomerRegistrationRequest) {
  const validation = validateMsisdnForCustomer(
    payload.primaryMsisdn,
    payload,
    "addSubscriber",
  );

  if (!validation.accepted) {
    return { customer: null, validation };
  }

  const customer: Customer = {
    id: `cus-${Math.random().toString(36).slice(2, 9)}`,
    businessName: payload.businessName,
    registrationNumber: payload.registrationNumber,
    businessEmail: payload.businessEmail,
    businessPhone: payload.businessPhone,
    contactPerson: payload.contactPerson,
    email: payload.contactEmail,
    phone: payload.contactPhone,
    apnName: payload.apnName,
    apnId: payload.apnId,
    primaryMsisdns: [payload.primaryMsisdn],
    secondaryCount: 0,
    bundlePurchases: 0,
    totalSpendUgx: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  customers.unshift(customer);
  balances.unshift({
    primaryMsisdn: payload.primaryMsisdn,
    bundleName: "No active bundle",
    totalVolumeGb: 0,
    remainingVolumeGb: 0,
    expiryAt: new Date().toISOString(),
    autoTopupRemaining: 0,
  });
  addAuditEvent({
    category: "customer",
    action: "Customer registered",
    actor: customer.businessName,
    outcome: "success",
  });

  return {
    customer,
    validation,
    activation: createAccountActivationNotice(customer),
  };
}

export function createServiceRequest(payload: ServiceRequestRequest) {
  const preferredPackage = payload.preferredPackageId
    ? bundles.find((bundle) => bundle.id === payload.preferredPackageId)
    : undefined;
  const serviceRequest: ServiceRequest = {
    id: `srv-${Math.random().toString(36).slice(2, 9)}`,
    businessName: payload.businessName,
    contactPerson: payload.contactPerson,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    preferredPackageId: preferredPackage?.id,
    preferredPackageName: preferredPackage?.name,
    message: payload.message,
    status: "new",
    createdAt: new Date().toISOString(),
  };

  serviceRequests.unshift(serviceRequest);
  addAuditEvent({
    category: "customer",
    action: "Public service request submitted",
    actor: serviceRequest.businessName,
    outcome: "success",
  });

  return serviceRequest;
}

export function updateServiceRequest(
  serviceRequestId: string,
  payload: ServiceRequestUpdateRequest,
) {
  const serviceRequest = serviceRequests.find(
    (item) => item.id === serviceRequestId,
  );

  if (!serviceRequest || serviceRequest.status === "converted") {
    return null;
  }

  serviceRequest.status = payload.status;
  addAuditEvent({
    category: "customer",
    action: `Service request marked ${payload.status}`,
    actor: serviceRequest.businessName,
    outcome: "success",
  });

  return serviceRequest;
}

export function convertServiceRequestToCustomer(
  serviceRequestId: string,
  payload: ServiceRequestConversionRequest,
) {
  const serviceRequest = serviceRequests.find(
    (item) => item.id === serviceRequestId,
  );

  if (!serviceRequest || serviceRequest.status === "converted") {
    return null;
  }

  const result = registerCustomer(payload);

  if (!result.customer) {
    return { serviceRequest, customer: null, validation: result.validation };
  }

  serviceRequest.status = "converted";
  addAuditEvent({
    category: "customer",
    action: "Service request converted to customer",
    actor: serviceRequest.businessName,
    outcome: "success",
  });

  return {
    serviceRequest,
    customer: result.customer,
    validation: result.validation,
  };
}

export function updateCustomer(
  customerId: string,
  payload: CustomerUpdateRequest,
) {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return null;
  }

  Object.assign(customer, {
    businessName: payload.businessName ?? customer.businessName,
    businessEmail: payload.businessEmail ?? customer.businessEmail,
    businessPhone: payload.businessPhone ?? customer.businessPhone,
    contactPerson: payload.contactPerson ?? customer.contactPerson,
    email: payload.contactEmail ?? customer.email,
    phone: payload.contactPhone ?? customer.phone,
    apnName: payload.apnName ?? customer.apnName,
    apnId: payload.apnId ?? customer.apnId,
  });
  addAuditEvent({
    category: "customer",
    action: "Customer details updated",
    actor: customer.businessName,
    outcome: "success",
  });

  return customer;
}

export function changeCustomerStatus(
  customerId: string,
  payload: CustomerStatusChangeRequest,
) {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return null;
  }

  customer.status = payload.status;
  customer.deactivationReason =
    payload.status === "deactivated" ? payload.reason : undefined;
  addAuditEvent({
    category: "customer",
    action:
      payload.status === "active"
        ? "Customer reactivated"
        : "Customer deactivated",
    actor: customer.businessName,
    outcome: "success",
  });

  return customer;
}

export function addPrimaryMsisdn(
  customerId: string,
  payload: PrimaryMsisdnRequest,
) {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return null;
  }

  const validation = validateMsisdnForCustomer(
    payload.primaryMsisdn,
    customer,
    "addSubscriber",
  );

  if (
    !validation.accepted ||
    customer.primaryMsisdns.includes(payload.primaryMsisdn)
  ) {
    return {
      customer,
      validation: customer.primaryMsisdns.includes(payload.primaryMsisdn)
        ? {
            ...validation,
            accepted: false,
            reason: "Primary MSISDN is already registered to this customer",
          }
        : validation,
    };
  }

  customer.primaryMsisdns.push(payload.primaryMsisdn);
  balances.unshift({
    primaryMsisdn: payload.primaryMsisdn,
    bundleName: "No active bundle",
    totalVolumeGb: 0,
    remainingVolumeGb: 0,
    expiryAt: new Date().toISOString(),
    autoTopupRemaining: 0,
  });
  addAuditEvent({
    category: "customer",
    action: "Primary MSISDN added",
    actor: customer.businessName,
    outcome: "success",
  });

  return { customer, validation };
}

export function getCustomerBalance(primaryMsisdn: string) {
  return (
    balances.find((balance) => balance.primaryMsisdn === primaryMsisdn) ?? {
      primaryMsisdn,
      bundleName: "No active bundle",
      totalVolumeGb: 0,
      remainingVolumeGb: 0,
      expiryAt: new Date().toISOString(),
      autoTopupRemaining: 0,
    }
  );
}

export function getSecondaryNumbers(customerId: string, primaryMsisdn: string) {
  return secondaryNumbers.filter(
    (item) =>
      item.customerId === customerId &&
      item.primaryMsisdn === primaryMsisdn &&
      item.status === "active",
  );
}

function usageSeed(value: string) {
  return value
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function getSecondaryNumberUsage(
  customerId: string,
  primaryMsisdn: string,
  secondaryMsisdn: string,
): SecondaryUsageResult | null {
  const customer = customers.find((item) => item.id === customerId);
  const secondaryNumber = secondaryNumbers.find(
    (item) =>
      item.customerId === customerId &&
      item.primaryMsisdn === primaryMsisdn &&
      item.msisdn === secondaryMsisdn &&
      item.status === "active",
  );

  if (
    !customer ||
    !customer.primaryMsisdns.includes(primaryMsisdn) ||
    !secondaryNumber
  ) {
    return null;
  }

  const activeMembers = getSecondaryNumbers(customerId, primaryMsisdn);
  const balance = getCustomerBalance(primaryMsisdn);
  const allocatedVolumeGb =
    activeMembers.length > 0 ? balance.totalVolumeGb / activeMembers.length : 0;
  const usagePercent =
    allocatedVolumeGb > 0 ? 18 + (usageSeed(secondaryMsisdn) % 75) : 0;
  const usedVolumeGb = Math.min(
    allocatedVolumeGb,
    Number(((allocatedVolumeGb * usagePercent) / 100).toFixed(2)),
  );
  const remainingVolumeGb = Math.max(allocatedVolumeGb - usedVolumeGb, 0);
  const lastUsedAt = new Date(
    Date.now() -
      (usageSeed(`${primaryMsisdn}${secondaryMsisdn}`) % 72) * 60 * 60 * 1000,
  ).toISOString();

  return {
    customerId,
    primaryMsisdn,
    secondaryMsisdn,
    bundleName: balance.bundleName,
    allocatedVolumeGb: Number(allocatedVolumeGb.toFixed(2)),
    usedVolumeGb,
    remainingVolumeGb: Number(remainingVolumeGb.toFixed(2)),
    usagePercent,
    lastUsedAt,
    status: secondaryNumber.status,
  };
}

export function addSecondaryNumber(
  customerId: string,
  primaryMsisdn: string,
  payload: SecondaryNumberRequest,
) {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return null;
  }

  if (!customer.primaryMsisdns.includes(primaryMsisdn)) {
    return { secondaryNumber: null, validation: null };
  }

  const existing = secondaryNumbers.find(
    (item) => item.msisdn === payload.msisdn && item.status === "active",
  );
  const validation = existing
    ? ({
        msisdn: payload.msisdn,
        accepted: false,
        reason: "MSISDN is already part of a secondary number family",
        apnIds: [customer.apnId],
        registeredApnId: customer.apnId,
      } satisfies MsisdnValidationResult)
    : validateMsisdnForCustomer(payload.msisdn, customer, "addGroupMember");

  if (!validation.accepted) {
    return { secondaryNumber: null, validation };
  }

  const secondaryNumber: SecondaryNumber = {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    customerId,
    primaryMsisdn,
    msisdn: payload.msisdn,
    apnId: customer.apnId,
    status: "active",
    addedAt: new Date().toISOString(),
  };

  secondaryNumbers.unshift(secondaryNumber);
  customer.secondaryCount += 1;
  addAuditEvent({
    category: "customer",
    action: "Secondary MSISDN added",
    actor: customer.businessName,
    outcome: "success",
  });

  return { secondaryNumber, validation };
}

export function addBulkSecondaryNumbers(
  customerId: string,
  primaryMsisdn: string,
  payload: SecondaryBulkRequest,
): SecondaryBulkResult | null {
  const customer = customers.find((item) => item.id === customerId);

  if (!customer || !customer.primaryMsisdns.includes(primaryMsisdn)) {
    return null;
  }

  const result: SecondaryBulkResult = {
    added: [],
    rejected: [],
  };

  payload.msisdns.forEach((msisdn) => {
    const response = addSecondaryNumber(customerId, primaryMsisdn, { msisdn });

    if (!response?.validation) {
      result.rejected.push({
        msisdn,
        accepted: false,
        reason: "Customer or primary MSISDN not found",
        apnIds: [],
        registeredApnId: customer.apnId,
      });
      return;
    }

    if (response.secondaryNumber) {
      result.added.push(response.secondaryNumber);
    } else {
      result.rejected.push(response.validation);
    }
  });

  if (result.added.length > 0) {
    addAuditEvent({
      category: "customer",
      action: "Bulk secondary MSISDN upload processed",
      actor: customer.businessName,
      outcome: result.rejected.length > 0 ? "warning" : "success",
    });
  }

  return result;
}

export function removeSecondaryNumber(
  customerId: string,
  primaryMsisdn: string,
  msisdn: string,
) {
  const customer = customers.find((item) => item.id === customerId);
  const secondaryNumber = secondaryNumbers.find(
    (item) =>
      item.customerId === customerId &&
      item.primaryMsisdn === primaryMsisdn &&
      item.msisdn === msisdn &&
      item.status === "active",
  );

  if (!customer || !secondaryNumber) {
    return null;
  }

  secondaryNumber.status = "removed";
  customer.secondaryCount = Math.max(customer.secondaryCount - 1, 0);
  addAuditEvent({
    category: "customer",
    action: "Secondary MSISDN removed",
    actor: customer.businessName,
    outcome: "success",
  });

  return secondaryNumber;
}
