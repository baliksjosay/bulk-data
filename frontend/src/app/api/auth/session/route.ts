import { cookies } from "next/headers";
import { fail, ok } from "@/lib/api-response";
import {
  clearAuthSessionCookie,
  clearLiveAuthCookies,
  getAuthSessionCookieName,
  setAuthSessionCookie,
  verifySessionJwt,
} from "@/lib/auth-session-cookie";
import type { AuthLoginResult, AuthRole } from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const liveAccessTokenCookieName = "mtn_bds_live_access_token";
const liveRefreshTokenCookieName = "mtn_bds_live_refresh_token";
const defaultAccessTokenMaxAgeSeconds = 15 * 60;
const defaultRefreshTokenMaxAgeSeconds = 7 * 24 * 60 * 60;

type JsonRecord = Record<string, unknown>;
type LiveSessionRestoreResult = Readonly<{
  session: AuthLoginResult;
  accessToken?: string;
  refreshToken?: string;
}>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapEnvelope(payload: unknown) {
  return isRecord(payload) && "data" in payload ? payload.data : payload;
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

function getJwtExpiresAt(token: string | undefined, fallbackSeconds: number) {
  if (!token) {
    return new Date(Date.now() + fallbackSeconds * 1000).toISOString();
  }

  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  const expiresAt = exp ? exp * 1000 : Date.now() + fallbackSeconds * 1000;

  return new Date(expiresAt).toISOString();
}

function getJwtMaxAgeSeconds(
  token: string | undefined,
  fallbackSeconds: number,
) {
  if (!token) {
    return fallbackSeconds;
  }

  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;

  if (!exp) {
    return fallbackSeconds;
  }

  return Math.max(1, exp - Math.floor(Date.now() / 1000));
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

function mapLiveUser(user: JsonRecord) {
  const firstName = typeof user.firstName === "string" ? user.firstName : "";
  const lastName = typeof user.lastName === "string" ? user.lastName : "";
  const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
  const role = mapLiveRole(user.roles);
  const customerId =
    role === "customer" && typeof user.customerId === "string"
      ? user.customerId
      : undefined;

  return {
    id: String(user.id ?? ""),
    name: `${firstName} ${lastName}`.trim() || email || "User",
    email,
    role,
    ...(customerId ? { customerId } : {}),
  };
}

function buildSessionResult(
  user: AuthLoginResult["user"],
  sessionId: string,
  expiresAt: string,
): AuthLoginResult {
  return {
    user,
    session: {
      id: sessionId,
      expiresAt,
    },
    nextRoute:
      user.role === "customer"
        ? "/console?section=customer"
        : "/console?section=overview",
    promptPasswordlessSetup: false,
  };
}

async function refreshLiveSession(
  baseUrl: string,
  refreshToken: string,
): Promise<LiveSessionRestoreResult | null> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = unwrapEnvelope(await response.json());

  if (!isRecord(payload) || !isRecord(payload.user)) {
    return null;
  }

  const accessToken =
    typeof payload.accessToken === "string" ? payload.accessToken : "";
  const rotatedRefreshToken =
    typeof payload.refreshToken === "string"
      ? payload.refreshToken
      : refreshToken;

  if (!accessToken) {
    return null;
  }

  const user = mapLiveUser(payload.user);

  if (!user.id || !user.email) {
    return null;
  }

  const sessionId =
    typeof payload.sessionId === "string"
      ? payload.sessionId
      : `live-${user.id}`;

  return {
    session: buildSessionResult(
      user,
      sessionId,
      getJwtExpiresAt(rotatedRefreshToken, defaultRefreshTokenMaxAgeSeconds),
    ),
    accessToken,
    refreshToken: rotatedRefreshToken,
  };
}

async function restoreLiveSession(): Promise<LiveSessionRestoreResult | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(liveAccessTokenCookieName)?.value;
  const refreshToken = cookieStore.get(liveRefreshTokenCookieName)?.value;

  const baseUrl = process.env.LIVE_API_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("LIVE_API_BASE_URL is not configured");
  }

  if (!accessToken) {
    return refreshToken ? refreshLiveSession(baseUrl, refreshToken) : null;
  }

  const response = await fetch(`${baseUrl}/users/me`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return refreshToken ? refreshLiveSession(baseUrl, refreshToken) : null;
  }

  const payload = unwrapEnvelope(await response.json());

  if (!isRecord(payload)) {
    return null;
  }

  const user = mapLiveUser(payload);

  if (!user.id || !user.email) {
    return null;
  }

  return {
    session: buildSessionResult(
      user,
      `live-${user.id}`,
      getJwtExpiresAt(
        refreshToken ?? accessToken,
        refreshToken
          ? defaultRefreshTokenMaxAgeSeconds
          : defaultAccessTokenMaxAgeSeconds,
      ),
    ),
  };
}

async function restoreFrontendSession(): Promise<AuthLoginResult | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthSessionCookieName())?.value;
  const payload = token ? verifySessionJwt(token) : null;

  if (!payload?.email || !payload.name) {
    return null;
  }

  return buildSessionResult(
    {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      ...(payload.customerId ? { customerId: payload.customerId } : {}),
    },
    payload.sid,
    new Date(payload.exp * 1000).toISOString(),
  );
}

function setLiveAuthCookies(
  response: ReturnType<typeof ok<AuthLoginResult>>,
  result: LiveSessionRestoreResult,
) {
  const secure = process.env.NODE_ENV === "production";

  if (result.accessToken) {
    response.cookies.set({
      name: liveAccessTokenCookieName,
      value: result.accessToken,
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: getJwtMaxAgeSeconds(
        result.accessToken,
        defaultAccessTokenMaxAgeSeconds,
      ),
    });
  }

  if (result.refreshToken) {
    response.cookies.set({
      name: liveRefreshTokenCookieName,
      value: result.refreshToken,
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: getJwtMaxAgeSeconds(
        result.refreshToken,
        defaultRefreshTokenMaxAgeSeconds,
      ),
    });
  }
}

function noActiveSessionResponse() {
  const response = fail("No active session", 401);
  clearAuthSessionCookie(response);
  clearLiveAuthCookies(response);

  return response;
}

export async function GET() {
  try {
    const liveMode = process.env.NEXT_PUBLIC_API_MODE === "live";
    const restoreResult = liveMode
      ? await restoreLiveSession()
      : await restoreFrontendSession();
    const session = liveMode
      ? (restoreResult as LiveSessionRestoreResult | null)?.session
      : (restoreResult as AuthLoginResult | null);

    if (!session) {
      return noActiveSessionResponse();
    }

    const response = ok(session, "Session restored successfully");
    setAuthSessionCookie(response, session);
    if (liveMode) {
      setLiveAuthCookies(response, restoreResult as LiveSessionRestoreResult);
    }

    return response;
  } catch {
    const response = fail("Session restore failed", 502);
    clearAuthSessionCookie(response);
    clearLiveAuthCookies(response);
    return response;
  }
}
