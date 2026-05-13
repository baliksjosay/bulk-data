import { createHmac, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import type { AuthLoginResult } from "@/types/domain";

const productionCookieName = "__Host-mtn_bds_session";
const developmentCookieName = "mtn_bds_session";
const fallbackDevelopmentSecret = randomBytes(32).toString("base64url");

export const sessionCookieMaxAgeSeconds = 8 * 60 * 60;

function getSessionCookieName() {
  return process.env.NODE_ENV === "production" ? productionCookieName : developmentCookieName;
}

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_COOKIE_SECRET;

  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_COOKIE_SECRET must be configured with at least 32 characters.");
  }

  return fallbackDevelopmentSecret;
}

function encodeSegment(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(unsignedJwt: string) {
  return createHmac("sha256", getSessionSecret()).update(unsignedJwt).digest("base64url");
}

export function createSessionJwt(result: AuthLoginResult) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor(new Date(result.session.expiresAt).getTime() / 1000);
  const header = encodeSegment({
    alg: "HS256",
    typ: "JWT",
  });
  const payload = encodeSegment({
    iss: "mtn-bulk-data-wholesale-frontend",
    aud: "mtn-bulk-data-wholesale-api",
    sub: result.user.id,
    sid: result.session.id,
    role: result.user.role,
    customerId: result.user.customerId,
    iat: issuedAt,
    exp: expiresAt,
    jti: randomBytes(16).toString("base64url"),
  });
  const unsignedJwt = `${header}.${payload}`;

  return `${unsignedJwt}.${signJwt(unsignedJwt)}`;
}

export function setAuthSessionCookie(response: NextResponse, result: AuthLoginResult) {
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
