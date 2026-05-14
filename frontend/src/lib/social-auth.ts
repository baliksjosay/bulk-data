"use client";

import type { SocialLoginProvider } from "@/types/domain";

type SocialPopupMessage = {
  type: "mtn-bds-social-auth";
  provider: SocialLoginProvider;
  idToken?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

const popupMessageType = "mtn-bds-social-auth";

function randomToken(length = 24) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);

    return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(
      "",
    );
  }

  return Array.from(
    { length },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function getRedirectUri(provider: SocialLoginProvider) {
  return `${window.location.origin}/auth/callback/${provider}`;
}

function buildGoogleUrl(state: string, nonce: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri("google"),
    response_type: "id_token",
    scope: "openid email profile",
    prompt: "select_account",
    nonce,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildMicrosoftUrl(state: string, nonce: string) {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("Microsoft sign-in is not configured.");
  }

  const tenantId =
    process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID?.trim() || "common";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri("microsoft"),
    response_type: "id_token",
    response_mode: "fragment",
    scope: "openid profile email",
    prompt: "select_account",
    nonce,
    state,
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

function buildSocialAuthUrl(
  provider: SocialLoginProvider,
  state: string,
  nonce: string,
) {
  return provider === "google"
    ? buildGoogleUrl(state, nonce)
    : buildMicrosoftUrl(state, nonce);
}

export async function beginSocialPopupLogin(provider: SocialLoginProvider) {
  const state = randomToken();
  const nonce = randomToken();
  const authUrl = buildSocialAuthUrl(provider, state, nonce);
  const popup = window.open(
    authUrl,
    `mtn-bds-${provider}-login`,
    "popup=yes,width=520,height=680,menubar=no,toolbar=no,status=no",
  );

  if (!popup) {
    throw new Error("The sign-in popup was blocked. Allow popups and try again.");
  }

  popup.focus();

  return await new Promise<{ idToken: string }>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${provider} sign-in timed out.`));
    }, 90_000);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    }

    function handleMessage(event: MessageEvent<SocialPopupMessage>) {
      if (event.origin !== window.location.origin) {
        return;
      }

      const payload = event.data;

      if (
        !payload ||
        payload.type !== popupMessageType ||
        payload.provider !== provider
      ) {
        return;
      }

      cleanup();

      if (payload.state !== state) {
        reject(new Error("Social sign-in state could not be verified."));
        return;
      }

      if (payload.error) {
        reject(
          new Error(
            payload.errorDescription ||
              payload.error.replaceAll("_", " ") ||
              `${provider} sign-in failed.`,
          ),
        );
        return;
      }

      if (!payload.idToken) {
        reject(new Error(`${provider} sign-in did not return an identity token.`));
        return;
      }

      resolve({ idToken: payload.idToken });
    }

    window.addEventListener("message", handleMessage);
  });
}

