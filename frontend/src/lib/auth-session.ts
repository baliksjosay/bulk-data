"use client";

import { useSyncExternalStore } from "react";
import type { AuthLoginResult, AuthenticatedUser } from "@/types/domain";

export type StoredAuthSession = Readonly<{
  user: AuthenticatedUser;
  nextRoute: string;
}>;

export const authSessionStorageKey = "mtn-bds-auth-session";
const authSessionChangeEvent = "mtn-bds-auth-session-change";

export function getStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(authSessionStorageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    window.localStorage.removeItem(authSessionStorageKey);
    return null;
  }
}

export function persistAuthSession(result: AuthLoginResult) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    authSessionStorageKey,
    JSON.stringify({
      user: result.user,
      nextRoute: result.nextRoute,
    } satisfies StoredAuthSession),
  );
  window.dispatchEvent(new Event(authSessionChangeEvent));
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authSessionStorageKey);
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
  return useSyncExternalStore(subscribeToAuthSession, getStoredAuthSession, () => null);
}
