import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  clearAllAuthCookies,
  setAuthSessionCookie,
} from "@/lib/auth-session-cookie";
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRole,
  AuthSession,
  MfaConfiguration,
  UserPreferences,
} from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const liveAccessTokenCookieName = "mtn_bds_live_access_token";
const liveRefreshTokenCookieName = "mtn_bds_live_refresh_token";
const defaultAccessTokenMaxAgeSeconds = 15 * 60;
const defaultRefreshTokenMaxAgeSeconds = 7 * 24 * 60 * 60;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_RESPONSE_HEADERS = [
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const;

type JsonRecord = Record<string, unknown>;
type ProxyBodyResult = {
  path: string[];
  body?: BodyInit;
  method?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicLiveAuthPath(path: string[]) {
  const joinedPath = path.join("/");

  return (
    joinedPath === "auth/login" ||
    joinedPath === "auth/login/google" ||
    joinedPath === "auth/login/microsoft" ||
    joinedPath === "auth/mfa/start-login-challenge" ||
    joinedPath === "auth/mfa/complete-login" ||
    joinedPath === "auth/webauthn/authentication/options" ||
    joinedPath === "auth/webauthn/authentication/verify" ||
    joinedPath.startsWith("auth/activation/")
  );
}

function createProxyHeaders(request: NextRequest, path: string[]) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();

    if (
      !HOP_BY_HOP_HEADERS.has(normalizedKey) &&
      normalizedKey !== "authorization" &&
      normalizedKey !== "cookie"
    ) {
      headers.set(key, value);
    }
  });

  headers.set("accept", "application/json");

  const accessToken = request.cookies.get(liveAccessTokenCookieName)?.value;
  if (accessToken && !isPublicLiveAuthPath(path)) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

function isLogoutPath(path: string[]) {
  return path.join("/") === "auth/logout";
}

function rewriteLivePath(path: string[]) {
  const joinedPath = path.join("/");

  if (joinedPath === "preferences") {
    return ["users", "me", "preferences"];
  }

  if (joinedPath === "security/sessions") {
    return ["users", "me", "sessions"];
  }

  if (joinedPath.startsWith("security/sessions/")) {
    return ["users", "me", "sessions", ...path.slice(2)];
  }

  if (joinedPath === "security/mfa") {
    return ["auth", "mfa", "methods"];
  }

  if (joinedPath === "security/password-policy") {
    return ["auth", "security", "password-policy"];
  }

  if (joinedPath === "security/webauthn/options") {
    return ["auth", "webauthn", "registration", "options"];
  }

  if (joinedPath === "security/webauthn/devices") {
    return ["auth", "webauthn", "credentials"];
  }

  if (joinedPath.startsWith("security/webauthn/devices/")) {
    return ["auth", "webauthn", "credentials", ...path.slice(3)];
  }

  if (joinedPath === "security/totp/enrollment") {
    return ["auth", "mfa", "totp", "setup"];
  }

  if (joinedPath === "security/totp/enrollment/verify") {
    return ["auth", "mfa", "totp", "setup", "verify"];
  }

  return path;
}

function buildLiveUrl(path: string[], requestUrl: string) {
  const baseUrl = process.env.LIVE_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("LIVE_API_BASE_URL is not configured");
  }

  const url = new URL(requestUrl);
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = rewriteLivePath(path)
    .map(encodeURIComponent)
    .join("/");
  return `${normalizedBaseUrl}/${normalizedPath}${url.search}`;
}

function copyProxyResponseHeaders(source: Headers, target: NextResponse) {
  FORWARDED_RESPONSE_HEADERS.forEach((header) => {
    const value = source.get(header);

    if (value) {
      target.headers.set(header, value);
    }
  });
}

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return "Request failed";
  }

  const message = payload.message;

  if (Array.isArray(message)) {
    return message.join(", ");
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return "Request failed";
}

function isEnvelope(
  payload: unknown,
): payload is { success: boolean; data: unknown } {
  return (
    isRecord(payload) &&
    typeof payload.success === "boolean" &&
    "data" in payload
  );
}

function unwrapPayload(payload: unknown) {
  return isEnvelope(payload) ? payload.data : payload;
}

function isPaginatedPayload(
  payload: unknown,
): payload is { data: unknown[]; meta: JsonRecord } {
  return (
    isRecord(payload) && Array.isArray(payload.data) && isRecord(payload.meta)
  );
}

function normalizePaginationMeta(meta: JsonRecord) {
  const page = Number(meta.page ?? 1);
  const limit = Number(meta.limit ?? 20);
  const total = Number(meta.total ?? 0);
  const totalPages = Math.max(Number(meta.totalPages ?? 1), 1);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage:
      typeof meta.hasNextPage === "boolean"
        ? meta.hasNextPage
        : page < totalPages,
    hasPreviousPage:
      typeof meta.hasPreviousPage === "boolean"
        ? meta.hasPreviousPage
        : page > 1,
  };
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as JsonRecord;
  } catch {
    return null;
  }
}

function getJwtMaxAgeSeconds(token: string, fallbackSeconds: number) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;

  if (!exp) {
    return fallbackSeconds;
  }

  return Math.max(1, exp - Math.floor(Date.now() / 1000));
}

function getJwtExpiresAt(token: string, fallbackSeconds: number) {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const expiresAt = exp ? exp * 1000 : Date.now() + fallbackSeconds * 1000;

  return new Date(expiresAt).toISOString();
}

function mapLiveRole(roles: unknown): AuthRole {
  const liveRoles = Array.isArray(roles) ? roles.map(String) : [];

  if (liveRoles.includes("ADMIN") || liveRoles.includes("SUPER_ADMIN")) {
    return "admin";
  }

  if (liveRoles.includes("SUPPORT")) {
    return "support";
  }

  return "customer";
}

function mapLiveMfaMethod(
  method: string,
): "totp" | "email-otp" | "sms-otp" | "webauthn" | "recovery-code" {
  if (
    method === "totp" ||
    method === "email-otp" ||
    method === "sms-otp" ||
    method === "webauthn" ||
    method === "recovery-code"
  ) {
    return method;
  }

  return "email-otp";
}

function mapLiveMfaMethods(methods: unknown) {
  if (!Array.isArray(methods)) {
    return [];
  }

  return methods
    .filter((method): method is string => typeof method === "string")
    .map(mapLiveMfaMethod)
    .filter((method, index, list) => list.indexOf(method) === index);
}

function mapLiveUser(user: JsonRecord, fallbackId: string) {
  const firstName = typeof user.firstName === "string" ? user.firstName : "";
  const lastName = typeof user.lastName === "string" ? user.lastName : "";
  const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
  const name = `${firstName} ${lastName}`.trim() || email || "Live user";
  const role = mapLiveRole(user.roles);
  const customerId =
    role === "customer" && typeof user.customerId === "string"
      ? user.customerId
      : undefined;

  return {
    id: String(user.id ?? fallbackId),
    name,
    email,
    role,
    ...(customerId ? { customerId } : {}),
  };
}

function mapLiveAuthResult(
  payload: unknown,
  options: { promptPasswordlessSetupFallback: boolean },
): AuthLoginResponse | null {
  const data = unwrapPayload(payload);

  if (!isRecord(data) || !isRecord(data.user)) {
    return null;
  }

  if (data.mfaRequired) {
    const challengeToken =
      typeof data.challengeToken === "string" ? data.challengeToken : "";
    const challengeId =
      typeof data.challengeId === "string" ? data.challengeId : "";
    const mfaSelectionToken =
      typeof data.mfaSelectionToken === "string" ? data.mfaSelectionToken : "";
    const mfaMethod =
      typeof data.mfaMethod === "string" ? data.mfaMethod : "email-otp";
    const availableMfaMethods = mapLiveMfaMethods(data.availableMfaMethods);
    const preferredMfaMethod =
      typeof data.preferredMfaMethod === "string"
        ? mapLiveMfaMethod(data.preferredMfaMethod)
        : (availableMfaMethods[0] ?? mapLiveMfaMethod(mfaMethod));

    if (!mfaSelectionToken && (!challengeToken || !challengeId)) {
      return null;
    }

    return {
      mfaRequired: true,
      ...(mfaSelectionToken
        ? { mfaSelectionToken }
        : { challengeToken, challengeId }),
      mfaMethod: mapLiveMfaMethod(mfaMethod),
      availableMfaMethods,
      preferredMfaMethod,
      ...(isRecord(data.mfaChallengeMetadata)
        ? { mfaChallengeMetadata: data.mfaChallengeMetadata }
        : {}),
      user: mapLiveUser(data.user, challengeId || mfaSelectionToken),
      message: mfaSelectionToken
        ? "Choose a verification method"
        : "MFA verification required",
    };
  }

  const user = data.user;
  const accessToken =
    typeof data.accessToken === "string" ? data.accessToken : "";
  const refreshToken =
    typeof data.refreshToken === "string" ? data.refreshToken : "";
  const sessionId =
    typeof data.sessionId === "string"
      ? data.sessionId
      : `live-${user.id ?? "session"}`;
  const mappedUser = mapLiveUser(user, sessionId);
  const promptPasswordlessSetup =
    typeof data.promptPasswordlessSetup === "boolean"
      ? data.promptPasswordlessSetup
      : options.promptPasswordlessSetupFallback;
  const promptData = isRecord(data.passwordlessSetupPrompt)
    ? data.passwordlessSetupPrompt
    : {};
  const passwordlessSetupPrompt = promptPasswordlessSetup
    ? {
        title:
          typeof promptData.title === "string"
            ? promptData.title
            : "Set up faster sign-in",
        message:
          typeof promptData.message === "string"
            ? promptData.message
            : "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.",
        setupUrl:
          typeof promptData.setupUrl === "string"
            ? promptData.setupUrl
            : "/console?section=security",
      }
    : undefined;

  return {
    user: mappedUser,
    session: {
      id: sessionId,
      expiresAt: refreshToken
        ? getJwtExpiresAt(refreshToken, defaultRefreshTokenMaxAgeSeconds)
        : getJwtExpiresAt(accessToken, defaultAccessTokenMaxAgeSeconds),
    },
    nextRoute:
      mappedUser.role === "customer"
        ? "/console?section=customer"
        : "/console?section=overview",
    promptPasswordlessSetup,
    passwordlessSetupPrompt,
  };
}

function shouldPromptPasswordlessSetupForLivePath(joinedPath: string) {
  return joinedPath !== "auth/webauthn/authentication/verify";
}

function setLiveAuthCookies(response: NextResponse, payload: unknown) {
  const data = unwrapPayload(payload);

  if (!isRecord(data)) {
    return;
  }

  const secure = process.env.NODE_ENV === "production";
  const accessToken =
    typeof data.accessToken === "string" ? data.accessToken : "";
  const refreshToken =
    typeof data.refreshToken === "string" ? data.refreshToken : "";

  if (accessToken) {
    response.cookies.set({
      name: liveAccessTokenCookieName,
      value: accessToken,
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: getJwtMaxAgeSeconds(accessToken, defaultAccessTokenMaxAgeSeconds),
    });
  }

  if (refreshToken) {
    response.cookies.set({
      name: liveRefreshTokenCookieName,
      value: refreshToken,
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge: getJwtMaxAgeSeconds(
        refreshToken,
        defaultRefreshTokenMaxAgeSeconds,
      ),
    });
  }
}

function mapLivePreferences(payload: unknown): UserPreferences {
  const data = unwrapPayload(payload);
  const record = isRecord(data) ? data : {};
  const dashboardPreferences = isRecord(record.dashboardPreferences)
    ? record.dashboardPreferences
    : {};
  const quietHours = isRecord(dashboardPreferences.quietHours)
    ? dashboardPreferences.quietHours
    : {};
  const theme =
    record.theme === "dark" ||
    record.theme === "light" ||
    record.theme === "system"
      ? record.theme
      : "system";
  const language = record.language === "lug" ? "lug" : "en";
  const defaultLanding =
    dashboardPreferences.defaultLanding === "admin" ||
    dashboardPreferences.defaultLanding === "customer" ||
    dashboardPreferences.defaultLanding === "security" ||
    dashboardPreferences.defaultLanding === "overview"
      ? dashboardPreferences.defaultLanding
      : "overview";
  const dataDensity =
    dashboardPreferences.dataDensity === "compact" ? "compact" : "comfortable";
  const quietHoursStart =
    typeof quietHours.start === "string" &&
    /^\d{2}:\d{2}$/.test(quietHours.start)
      ? quietHours.start
      : "20:00";
  const quietHoursEnd =
    typeof quietHours.end === "string" && /^\d{2}:\d{2}$/.test(quietHours.end)
      ? quietHours.end
      : "07:00";

  return {
    theme,
    language,
    timezone:
      typeof record.timezone === "string" ? record.timezone : "Africa/Kampala",
    defaultLanding,
    dataDensity,
    quietHours: {
      enabled: quietHours.enabled === true,
      start: quietHoursStart,
      end: quietHoursEnd,
    },
    notifications: {
      email: record.emailNotifications !== false,
      sms: dashboardPreferences.smsNotifications !== false,
      whatsapp: dashboardPreferences.whatsappNotifications === true,
      inApp: record.inAppNotifications !== false,
    },
  };
}

function mapPreferencesRequest(payload: unknown) {
  if (!isRecord(payload)) {
    return payload;
  }

  const notifications = isRecord(payload.notifications)
    ? payload.notifications
    : {};

  return {
    theme: payload.theme,
    language: "en",
    timezone: payload.timezone,
    emailNotifications: notifications.email,
    pushNotifications: notifications.whatsapp ?? notifications.sms,
    inAppNotifications: notifications.inApp,
    dashboardPreferences: {
      defaultLanding: payload.defaultLanding,
      dataDensity: payload.dataDensity,
      quietHours: payload.quietHours,
      smsNotifications: notifications.sms,
      whatsappNotifications: notifications.whatsapp,
    },
  };
}

function mapLiveSessions(payload: unknown): AuthSession[] {
  const data = unwrapPayload(payload);
  const sessions = Array.isArray(data) ? data : [];

  return sessions.filter(isRecord).map((session) => ({
    id: String(session.id ?? ""),
    device: String(session.deviceType ?? session.deviceId ?? "Unknown device"),
    browser: String(session.browser ?? "Unknown browser"),
    ipAddress: String(session.ipAddress ?? ""),
    location: "Unknown",
    createdAt: String(session.createdAt ?? new Date().toISOString()),
    lastActiveAt: String(
      session.lastActivityAt ??
        session.updatedAt ??
        session.createdAt ??
        new Date().toISOString(),
    ),
    current: false,
    status: session.isActive === false ? "revoked" : "active",
  }));
}

function mapLiveMfaConfiguration(payload: unknown): MfaConfiguration {
  const data = unwrapPayload(payload);
  const methods =
    isRecord(data) && Array.isArray(data.methods)
      ? data.methods.map(String)
      : [];
  const now = new Date().toISOString();

  return {
    services: [
      {
        id: "totp",
        label: "Authenticator app",
        enabled: methods.includes("totp"),
        requiredForAdmins: true,
        requiredForCustomers: false,
        lastUpdatedAt: now,
      },
      {
        id: "email_otp",
        label: "Email OTP",
        enabled: methods.includes("email_otp"),
        requiredForAdmins: false,
        requiredForCustomers: false,
        lastUpdatedAt: now,
      },
      {
        id: "sms_otp",
        label: "SMS OTP",
        enabled: methods.includes("sms_otp"),
        requiredForAdmins: false,
        requiredForCustomers: false,
        lastUpdatedAt: now,
      },
      {
        id: "webauthn",
        label: "Passkeys and security keys",
        enabled: methods.includes("webauthn"),
        requiredForAdmins: true,
        requiredForCustomers: false,
        lastUpdatedAt: now,
      },
      {
        id: "recovery_codes",
        label: "Recovery codes",
        enabled: methods.includes("recovery_codes"),
        requiredForAdmins: true,
        requiredForCustomers: false,
        lastUpdatedAt: now,
      },
    ],
    trustedDeviceDays: 30,
    stepUpForBundlePurchases: true,
    stepUpForSecondaryNumberChanges: true,
  };
}

function parseJsonBody(text: string) {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function createProxyBody(
  request: NextRequest,
  path: string[],
  headers: Headers,
): Promise<ProxyBodyResult | NextResponse> {
  const method = request.method.toUpperCase();

  if (method === "GET" || method === "HEAD") {
    return { path };
  }

  const text = await request.text();
  const joinedPath = path.join("/");

  if (joinedPath === "auth/login") {
    const payload = parseJsonBody(text) as AuthLoginRequest | null;

    if (!payload) {
      return fail("Login payload is required", 422);
    }

    if (payload.method === "password") {
      const identifier = (
        payload.identifier ??
        payload.username ??
        payload.email ??
        payload.phoneNumber ??
        ""
      ).trim();

      if (!identifier || !payload.password) {
        return fail(
          "Password login requires TIN, phone number, email, or staff username and password",
          422,
        );
      }

      headers.set("content-type", "application/json");
      return {
        path,
        body: JSON.stringify({
          identifier,
          password: payload.password,
          deviceId: request.headers.get("x-device-id") ?? undefined,
        }),
      };
    }

    return fail(
      "Use the passkey authentication endpoints for live passkey login",
      422,
    );
  }

  if (joinedPath === "preferences") {
    headers.set("content-type", "application/json");
    return {
      path,
      body: JSON.stringify(mapPreferencesRequest(parseJsonBody(text))),
    };
  }

  if (joinedPath === "security/totp/enrollment/verify") {
    const payload = parseJsonBody(text);
    const record = isRecord(payload) ? payload : {};

    headers.set("content-type", "application/json");
    return {
      path,
      body: JSON.stringify({
        challengeId: record.enrollmentId,
        code: record.code,
      }),
    };
  }

  return { path, body: text };
}

function createJsonResponseForLivePath(
  path: string[],
  payload: unknown,
  status: number,
) {
  const joinedPath = path.join("/");

  if (
    joinedPath === "auth/login" ||
    joinedPath === "auth/login/google" ||
    joinedPath === "auth/login/microsoft" ||
    joinedPath === "auth/mfa/start-login-challenge" ||
    joinedPath === "auth/mfa/complete-login" ||
    joinedPath === "auth/activation/password" ||
    joinedPath === "auth/webauthn/authentication/verify"
  ) {
    const result = mapLiveAuthResult(payload, {
      promptPasswordlessSetupFallback:
        shouldPromptPasswordlessSetupForLivePath(joinedPath),
    });

    if (!result) {
      return fail("Live authentication response could not be mapped", 409);
    }

    const response = ok(
      result,
      result.mfaRequired
        ? "MFA verification required"
        : "Signed in successfully",
    );
    setLiveAuthCookies(response, payload);
    if (result.mfaRequired !== true) {
      setAuthSessionCookie(response, result);
    }
    return response;
  }

  if (joinedPath === "preferences") {
    return ok(mapLivePreferences(payload), "Preferences fetched successfully");
  }

  if (joinedPath === "auth/logout") {
    const response = ok(
      { message: "Logged out successfully" },
      "Logged out successfully",
    );
    clearAllAuthCookies(response);
    return response;
  }

  if (joinedPath === "security/sessions") {
    return ok(mapLiveSessions(payload), "Sessions fetched successfully");
  }

  if (joinedPath === "security/mfa") {
    return ok(
      mapLiveMfaConfiguration(payload),
      "MFA configuration fetched successfully",
    );
  }

  if (isEnvelope(payload)) {
    return NextResponse.json(payload, { status });
  }

  const unwrappedPayload = unwrapPayload(payload);

  if (isPaginatedPayload(unwrappedPayload)) {
    return NextResponse.json(
      {
        success: true,
        message: "Records fetched successfully",
        data: unwrappedPayload.data,
        meta: normalizePaginationMeta(unwrappedPayload.meta),
      },
      { status },
    );
  }

  return ok(unwrappedPayload, "Request completed successfully");
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.LIVE_API_TIMEOUT_MS ?? 15_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const method = request.method.toUpperCase();
    const headers = createProxyHeaders(request, path);
    const proxyBody = await createProxyBody(request, path, headers);

    if (proxyBody instanceof NextResponse) {
      return proxyBody;
    }

    let liveUrl: string;

    try {
      liveUrl = buildLiveUrl(proxyBody.path, request.url);
    } catch (error) {
      const failureResponse = fail(
        error instanceof Error ? error.message : "Live API is not configured",
        500,
      );

      if (isLogoutPath(path)) {
        clearAllAuthCookies(failureResponse);
      }

      return failureResponse;
    }

    const response = await fetch(liveUrl, {
      method:
        proxyBody.method ??
        (path.join("/") === "preferences" && method === "PUT"
          ? "PATCH"
          : method),
      headers,
      body: proxyBody.body,
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType =
      response.headers.get("content-type") ?? "application/json";
    const responseBody = await response.text();
    const jsonPayload = contentType.includes("application/json")
      ? parseJsonBody(responseBody)
      : null;
    const proxiedResponse =
      jsonPayload === null
        ? new NextResponse(responseBody, {
            status: response.status,
            headers: {
              "content-type": contentType,
            },
          })
        : response.ok
          ? createJsonResponseForLivePath(
              proxyBody.path,
              jsonPayload,
              response.status,
            )
          : fail(getErrorMessage(jsonPayload), response.status);

    if (response.status === 401 || isLogoutPath(proxyBody.path)) {
      clearAllAuthCookies(proxiedResponse);
    }

    copyProxyResponseHeaders(response.headers, proxiedResponse);
    return proxiedResponse;
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Live API request timed out"
        : "Live API request failed";

    const response = fail(message, 502);

    if (isLogoutPath(path)) {
      clearAllAuthCookies(response);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
