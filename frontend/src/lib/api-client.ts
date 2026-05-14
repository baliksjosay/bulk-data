import type {
  ApiEnvelope,
  ApiSuccessEnvelope,
  ApiValidationIssue,
  AccountActivationOtpRequest,
  AccountActivationOtpResult,
  AccountActivationOtpVerificationRequest,
  AccountActivationOtpVerificationResult,
  AccountActivationPasswordRequest,
  AdminReport,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthLoginResult,
  AuthMfaChallenge,
  AuthSession,
  BalanceResult,
  AuditEvent,
  BundleOffer,
  BundlePackageRequest,
  BundlePackageUpdateRequest,
  Customer,
  CustomerRegistrationResult,
  CustomerRegistrationRequest,
  CustomerStatusChangeRequest,
  CustomerUpdateRequest,
  CustomerReport,
  ListQuery,
  MsisdnValidationResult,
  MfaConfiguration,
  NotificationListResult,
  NotificationReadResult,
  NotificationUnreadCount,
  Overview,
  OverviewQuery,
  PaginatedList,
  ProvisioningAddGroupMembersBulkRequest,
  ProvisioningAddSubscriberRequest,
  ProvisioningCommandResult,
  ProvisioningDeleteGroupMemberRequest,
  ProvisioningGroupMemberPair,
  ProvisioningUpdateSubscriptionRequest,
  PrimaryMsisdnRequest,
  PurchaseConfirmationRequest,
  PurchaseConfirmationResult,
  PurchaseRequest,
  PurchaseRetryRequest,
  PurchaseResult,
  ReportTransaction,
  ReportTransactionQuery,
  SecondaryBulkRequest,
  SecondaryBulkResult,
  SecondaryNumber,
  SecondaryNumberRequest,
  SecondaryUsageResult,
  ServiceRequest,
  ServiceRequestConversionRequest,
  ServiceRequestConversionResult,
  ServiceRequestRequest,
  ServiceRequestUpdateRequest,
  StaffUserCreateRequest,
  TotpAuthenticatorApp,
  TotpEnrollment,
  TotpEnrollmentRequest,
  TotpVerificationRequest,
  TotpVerificationResult,
  UserAccount,
  UserPreferences,
  WebAuthnAuthenticationOptions,
  WebAuthnDevice,
  WebAuthnRegistrationOptions,
} from "@/types/domain";

export class ApiClientError extends Error {
  readonly status: number;
  readonly errors: ApiValidationIssue[];

  constructor(
    message: string,
    status: number,
    errors: ApiValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const envelope = await requestEnvelope<T>(path, init);

  return envelope.data;
}

async function requestEnvelope<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiSuccessEnvelope<T>> {
  const bodyIsFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (!bodyIsFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiPath(path), {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });
  const envelope = await readApiEnvelope<T>(response);

  if (!response.ok || !envelope.success) {
    throw new ApiClientError(
      envelope.message || "Request failed",
      response.status,
      envelope.success ? [] : (envelope.errors ?? []),
    );
  }

  return envelope;
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const payload = await readJson(response);

  if (isApiEnvelope<T>(payload)) {
    return payload;
  }

  return {
    success: false,
    message: response.ok
      ? "API response was not in the expected format"
      : `Request failed with status ${response.status}`,
    data: null,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (value.success) {
    return typeof value.message === "string" && "data" in value;
  }

  return (
    typeof value.message === "string" &&
    (!("errors" in value) || Array.isArray(value.errors))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestPaginated<T>(
  path: string,
  init?: RequestInit,
): Promise<PaginatedList<T>> {
  const envelope = await requestEnvelope<T[]>(path, init);

  return {
    data: envelope.data,
    meta: envelope.meta ?? {
      page: 1,
      limit: envelope.data.length,
      total: envelope.data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function resolveApiPath(path: string) {
  const apiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "fake";

  if (apiMode === "fake") {
    return path;
  }

  const livePath = path.replace(/^\/api\/?/, "");
  return `/api/live/${livePath}`;
}

function withQuery(path: string, query: object) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function pathSegment(value: string) {
  return encodeURIComponent(value);
}

function customerPath(customerId: string) {
  return `/api/customers/${pathSegment(customerId)}`;
}

function primaryMsisdnPath(customerId: string, primaryMsisdn: string) {
  return `${customerPath(customerId)}/primary-msisdns/${pathSegment(primaryMsisdn)}`;
}

export const api = {
  login: (payload: AuthLoginRequest) =>
    request<AuthLoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  completeMfaLogin: (payload: {
    challengeToken: string;
    challengeId: string;
    code?: string;
    assertion?: Record<string, unknown>;
    recoveryCode?: string;
  }) =>
    request<AuthLoginResponse>("/api/auth/mfa/complete-login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startMfaLoginChallenge: (payload: {
    selectionToken: string;
    mfaMethod: NonNullable<AuthMfaChallenge["mfaMethod"]>;
  }) =>
    request<AuthMfaChallenge>("/api/auth/mfa/start-login-challenge", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createStaffUser: (payload: StaffUserCreateRequest) =>
    request<UserAccount>("/api/users/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startAccountActivationOtp: (payload: AccountActivationOtpRequest) =>
    request<AccountActivationOtpResult>("/api/auth/activation/otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyAccountActivationOtp: (
    payload: AccountActivationOtpVerificationRequest,
  ) =>
    request<AccountActivationOtpVerificationResult>(
      "/api/auth/activation/otp/verify",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  completeAccountActivationPassword: (
    payload: AccountActivationPasswordRequest,
  ) =>
    request<AuthLoginResult>("/api/auth/activation/password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  provisioningAddGroupMember: (payload: ProvisioningGroupMemberPair) =>
    request<ProvisioningCommandResult<ProvisioningGroupMemberPair>>(
      "/api/provisioning/group-member",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  provisioningAddGroupMembersBulk: (
    payload: ProvisioningAddGroupMembersBulkRequest,
  ) =>
    request<ProvisioningCommandResult<ProvisioningAddGroupMembersBulkRequest>>(
      "/api/provisioning/group-members/bulk",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  provisioningDeleteGroupMember: (
    payload: ProvisioningDeleteGroupMemberRequest,
  ) =>
    request<ProvisioningCommandResult<ProvisioningDeleteGroupMemberRequest>>(
      "/api/provisioning/group-member/delete",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  provisioningUpdateSubscription: (
    payload: ProvisioningUpdateSubscriptionRequest,
  ) =>
    request<ProvisioningCommandResult<ProvisioningUpdateSubscriptionRequest>>(
      "/api/provisioning/subscriptions/update",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  provisioningAddSubscriber: (payload: ProvisioningAddSubscriberRequest) =>
    request<ProvisioningCommandResult<ProvisioningAddSubscriberRequest>>(
      "/api/provisioning/subscriber",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  overview: (query: OverviewQuery = {}) =>
    request<Overview>(withQuery("/api/overview", query)),
  customers: () => request<Customer[]>("/api/customers"),
  customerPage: (query: ListQuery) =>
    requestPaginated<Customer>(withQuery("/api/customers", query)),
  registerCustomer: (payload: CustomerRegistrationRequest) =>
    request<CustomerRegistrationResult>("/api/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCustomer: (customerId: string, payload: CustomerUpdateRequest) =>
    request<Customer>(customerPath(customerId), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  changeCustomerStatus: (
    customerId: string,
    payload: CustomerStatusChangeRequest,
  ) =>
    request<Customer>(`${customerPath(customerId)}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addPrimaryMsisdn: (customerId: string, payload: PrimaryMsisdnRequest) =>
    request<{ customer: Customer; validation: MsisdnValidationResult }>(
      `${customerPath(customerId)}/primary-msisdns`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  balance: (customerId: string, primaryMsisdn: string) =>
    request<BalanceResult>(
      `${primaryMsisdnPath(customerId, primaryMsisdn)}/balance`,
    ),
  secondaryNumbers: (customerId: string, primaryMsisdn: string) =>
    request<SecondaryNumber[]>(
      `${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers`,
    ),
  secondaryNumbersPage: (
    customerId: string,
    primaryMsisdn: string,
    query: ListQuery,
  ) =>
    requestPaginated<SecondaryNumber>(
      withQuery(
        `${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers`,
        query,
      ),
    ),
  secondaryNumberUsage: (
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) =>
    request<SecondaryUsageResult>(
      `${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers/${pathSegment(secondaryMsisdn)}/usage`,
    ),
  addSecondaryNumber: (
    customerId: string,
    primaryMsisdn: string,
    payload: SecondaryNumberRequest,
  ) =>
    request<{
      secondaryNumber: SecondaryNumber;
      validation: MsisdnValidationResult;
    }>(`${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addBulkSecondaryNumbers: (
    customerId: string,
    primaryMsisdn: string,
    payload: SecondaryBulkRequest,
  ) =>
    request<SecondaryBulkResult>(
      `${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers/bulk`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  removeSecondaryNumber: (
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) =>
    request<SecondaryNumber>(
      `${primaryMsisdnPath(customerId, primaryMsisdn)}/secondary-numbers/${pathSegment(secondaryMsisdn)}`,
      {
        method: "DELETE",
      },
    ),
  bundles: () =>
    request<BundleOffer[]>(
      withQuery("/api/bundles", { status: "active", visible: true }),
    ),
  bundlePackages: () => request<BundleOffer[]>("/api/bundles"),
  createBundlePackage: (payload: BundlePackageRequest) =>
    request<BundleOffer>("/api/bundles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBundlePackage: (
    bundleId: string,
    payload: BundlePackageUpdateRequest,
  ) =>
    request<BundleOffer>(`/api/bundles/${pathSegment(bundleId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminReport: (query: ListQuery = {}) =>
    request<AdminReport>(withQuery("/api/reports/admin", query)),
  reportTransactions: (query: ReportTransactionQuery) =>
    requestPaginated<ReportTransaction>(
      withQuery("/api/reports/transactions", query),
    ),
  customerReport: (customerId: string, query: ListQuery = {}) =>
    request<CustomerReport>(
      withQuery("/api/reports/customer", {
        customerId,
        ...query,
      }),
    ),
  submitServiceRequest: (payload: ServiceRequestRequest) =>
    request<ServiceRequest>("/api/service-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  serviceRequestsPage: (query: ListQuery) =>
    requestPaginated<ServiceRequest>(withQuery("/api/service-requests", query)),
  updateServiceRequest: (
    serviceRequestId: string,
    payload: ServiceRequestUpdateRequest,
  ) =>
    request<ServiceRequest>(
      `/api/service-requests/${pathSegment(serviceRequestId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    ),
  convertServiceRequest: (
    serviceRequestId: string,
    payload: ServiceRequestConversionRequest,
  ) =>
    request<ServiceRequestConversionResult>(
      `/api/service-requests/${pathSegment(serviceRequestId)}/convert`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  auditEvents: () => request<AuditEvent[]>("/api/audit"),
  auditEventPage: (query: ListQuery) =>
    requestPaginated<AuditEvent>(withQuery("/api/audit", query)),
  purchaseBundle: (payload: PurchaseRequest) =>
    request<PurchaseResult>("/api/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  confirmPurchase: (
    transactionId: string,
    payload: PurchaseConfirmationRequest,
  ) =>
    request<PurchaseConfirmationResult>(
      `/api/purchases/${pathSegment(transactionId)}/confirmation`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  retryPurchase: (transactionId: string, payload: PurchaseRetryRequest = {}) =>
    request<PurchaseResult>(
      `/api/purchases/${pathSegment(transactionId)}/retry`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  notifications: (
    query: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  ) => request<NotificationListResult>(withQuery("/api/notifications", query)),
  unreadNotificationsCount: () =>
    request<NotificationUnreadCount>("/api/notifications/unread-count"),
  markNotificationsRead: (notificationIds: string[]) =>
    request<NotificationReadResult>("/api/notifications/mark-read", {
      method: "PATCH",
      body: JSON.stringify({ notificationIds }),
    }),
  markAllNotificationsRead: () =>
    request<NotificationReadResult>("/api/notifications/mark-all-read", {
      method: "PATCH",
      body: JSON.stringify({}),
    }),
  preferences: () => request<UserPreferences>("/api/preferences"),
  updatePreferences: (payload: UserPreferences) =>
    request<UserPreferences>("/api/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  mfaConfiguration: () => request<MfaConfiguration>("/api/security/mfa"),
  updateMfaConfiguration: (payload: MfaConfiguration) =>
    request<MfaConfiguration>("/api/security/mfa", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  webAuthnOptions: () =>
    request<WebAuthnRegistrationOptions>("/api/security/webauthn/options", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  webAuthnAuthenticationOptions: (payload: { email?: string }) =>
    request<WebAuthnAuthenticationOptions>(
      "/api/auth/webauthn/authentication/options",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  completeWebAuthnAuthentication: (payload: {
    assertion: Record<string, unknown>;
  }) =>
    request<AuthLoginResponse>("/api/auth/webauthn/authentication/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  webAuthnDevices: () =>
    request<WebAuthnDevice[]>("/api/security/webauthn/devices"),
  registerWebAuthnDevice: (payload: {
    label: string;
    credentialId: string;
    transports: AuthenticatorTransport[];
  }) =>
    request<WebAuthnDevice>("/api/security/webauthn/devices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  revokeWebAuthnDevice: (deviceId: string) =>
    request<WebAuthnDevice>(`/api/security/webauthn/devices/${deviceId}`, {
      method: "DELETE",
    }),
  authSessions: () => request<AuthSession[]>("/api/security/sessions"),
  revokeAuthSession: (sessionId: string) =>
    request<AuthSession>(`/api/security/sessions/${pathSegment(sessionId)}`, {
      method: "DELETE",
    }),
  totpAuthenticatorApps: () =>
    request<TotpAuthenticatorApp[]>("/api/security/totp/apps"),
  startTotpEnrollment: (payload: TotpEnrollmentRequest) =>
    request<TotpEnrollment>("/api/security/totp/enrollment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyTotpEnrollment: (payload: TotpVerificationRequest) =>
    request<TotpVerificationResult>("/api/security/totp/enrollment/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
