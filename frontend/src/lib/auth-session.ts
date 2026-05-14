"use client";

import { useSyncExternalStore } from "react";
import type { AuthLoginResult, AuthenticatedUser } from "@/types/domain";

export type StoredAuthSession = Readonly<{
  user: AuthenticatedUser;
  nextRoute: string;
}>;

export const authSessionStorageKey = "mtn-bds-auth-session";
const authSessionChangeEvent = "mtn-bds-auth-session-change";
let cachedAuthSessionRaw: string | null = null;
let cachedAuthSessionSnapshot: StoredAuthSession | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  const role = value.user.role;

  return (
    typeof value.nextRoute === "string" &&
    value.nextRoute.startsWith("/") &&
    typeof value.user.id === "string" &&
    typeof value.user.email === "string" &&
    typeof value.user.name === "string" &&
    (role === "admin" || role === "support" || role === "customer")
  );
}

function clearCachedAuthSession() {
  cachedAuthSessionRaw = null;
  cachedAuthSessionSnapshot = null;
}

export function getStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(authSessionStorageKey);

  if (raw === cachedAuthSessionRaw) {
    return cachedAuthSessionSnapshot;
  }

  cachedAuthSessionRaw = raw;

  if (!raw) {
    cachedAuthSessionSnapshot = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isStoredAuthSession(parsed)) {
      window.localStorage.removeItem(authSessionStorageKey);
      clearCachedAuthSession();
      return null;
    }

    cachedAuthSessionSnapshot = parsed;
    return cachedAuthSessionSnapshot;
  } catch {
    window.localStorage.removeItem(authSessionStorageKey);
    clearCachedAuthSession();
    return null;
  }
}

export function persistAuthSession(result: AuthLoginResult) {
  if (typeof window === "undefined") {
    return;
  }

  const session = {
    user: result.user,
    nextRoute: result.nextRoute,
  } satisfies StoredAuthSession;
  const serialized = JSON.stringify(session);

  cachedAuthSessionRaw = serialized;
  cachedAuthSessionSnapshot = session;
  window.localStorage.setItem(authSessionStorageKey, serialized);
  window.dispatchEvent(new Event(authSessionChangeEvent));
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authSessionStorageKey);
  clearCachedAuthSession();
  window.dispatchEvent(new Event(authSessionChangeEvent));
}

function subscribeToAuthSession(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(authSessionChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(authSessionChangeEvent, onStoreChange);
  };
}

export function useAuthSessionSnapshot() {
  return useSyncExternalStore(
    subscribeToAuthSession,
    getStoredAuthSession,
    () => null,
  );
}
