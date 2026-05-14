import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import type { AuthLoginResult, AuthRole } from "@/types/domain";

const productionCookieName = "__Host-mtn_bds_session";
const developmentCookieName = "mtn_bds_session";
const sessionCookieNames = [developmentCookieName, productionCookieName];
const liveAuthCookieNames = [
  "mtn_bds_live_access_token",
  "mtn_bds_live_refresh_token",
];
const fallbackDevelopmentSecret = randomBytes(32).toString("base64url");

export const sessionCookieMaxAgeSeconds = 8 * 60 * 60;

export type SessionCookiePayload = Readonly<{
  iss: string;
  aud: string;
  sub: string;
  sid: string;
  name?: string;
  email?: string;
  role: AuthRole;
  customerId?: string;
  iat: number;
  exp: number;
  jti: string;
}>;

function getSessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? productionCookieName
    : developmentCookieName;
}

export function getAuthSessionCookieName() {
  return getSessionCookieName();
}

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_COOKIE_SECRET;

  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_COOKIE_SECRET must be configured with at least 32 characters.",
    );
  }

  return fallbackDevelopmentSecret;
}

function encodeSegment(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeSegment<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function signJwt(unsignedJwt: string) {
  return createHmac("sha256", getSessionSecret())
    .update(unsignedJwt)
    .digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createSessionJwt(result: AuthLoginResult) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor(
    new Date(result.session.expiresAt).getTime() / 1000,
  );
  const header = encodeSegment({
    alg: "HS256",
    typ: "JWT",
  });
  const payload = encodeSegment({
    iss: "mtn-bulk-data-wholesale-frontend",
    aud: "mtn-bulk-data-wholesale-api",
    sub: result.user.id,
    sid: result.session.id,
    name: result.user.name,
    email: result.user.email,
    role: result.user.role,
    customerId: result.user.customerId,
    iat: issuedAt,
    exp: expiresAt,
    jti: randomBytes(16).toString("base64url"),
  });
  const unsignedJwt = `${header}.${payload}`;

  return `${unsignedJwt}.${signJwt(unsignedJwt)}`;
}

export function setAuthSessionCookie(
  response: NextResponse,
  result: AuthLoginResult,
) {
  response.cookies.set({
    name: getSessionCookieName(),
    value: createSessionJwt(result),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds,
  });
}

function expireCookie(response: NextResponse, name: string, secure: boolean) {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export function clearAuthSessionCookie(response: NextResponse) {
  sessionCookieNames.forEach((name) => {
    expireCookie(
      response,
      name,
      name === productionCookieName || process.env.NODE_ENV === "production",
    );
  });
}

export function clearLiveAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";

  liveAuthCookieNames.forEach((name) => {
    expireCookie(response, name, secure);
  });
}

export function clearAllAuthCookies(response: NextResponse) {
  clearLiveAuthCookies(response);
  clearAuthSessionCookie(response);
}

export function verifySessionJwt(token: string): SessionCookiePayload | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const unsignedJwt = `${header}.${payload}`;
  const expectedSignature = signJwt(unsignedJwt);

  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  const decoded = decodeSegment<SessionCookiePayload>(payload);
  const now = Math.floor(Date.now() / 1000);

  if (!decoded || decoded.exp <= now) {
    return null;
  }

  return decoded;
}

export function getSessionDashboardRoute(
  payload: Pick<SessionCookiePayload, "role">,
) {
  return payload.role === "customer"
    ? "/console?section=customer"
    : "/console?section=overview";
}
