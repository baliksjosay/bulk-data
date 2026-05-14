import { api } from "@/lib/api-client";
import type {
  AuthLoginResponse,
  AuthMfaChallenge,
  WebAuthnAuthenticationOptions,
  WebAuthnDevice,
  WebAuthnRegistrationResult,
} from "@/types/domain";

const liveApiEnabled = process.env.NEXT_PUBLIC_API_MODE === "live";

function base64UrlToArrayBuffer(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSimulatedCredentialId() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes.buffer);
}

export async function registerPasskey(label: string): Promise<WebAuthnDevice> {
  const options = await api.webAuthnOptions();

  if (!window.PublicKeyCredential || !navigator.credentials) {
    if (liveApiEnabled) {
      throw new Error("Passkey registration is not available in this browser");
    }

    return api.registerWebAuthnDevice({
      label,
      credentialId: `simulated-${createSimulatedCredentialId()}`,
      transports: ["internal"],
    });
  }

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: base64UrlToArrayBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64UrlToArrayBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey registration was cancelled");
  }

  if (liveApiEnabled) {
    const result = await api.finishWebAuthnRegistration({
      attestation: serializeAttestationCredential(credential),
    });

    return webAuthnRegistrationResultToDevice(result, label);
  }

  const attestationResponse =
    credential.response as AuthenticatorAttestationResponse;
  const transports: AuthenticatorTransport[] =
    typeof attestationResponse.getTransports === "function"
      ? (attestationResponse.getTransports() as AuthenticatorTransport[])
      : ["internal"];

  return api.registerWebAuthnDevice({
    label,
    credentialId: arrayBufferToBase64Url(credential.rawId),
    transports,
  });
}

function webAuthnRegistrationResultToDevice(
  result: WebAuthnRegistrationResult,
  fallbackLabel: string,
): WebAuthnDevice {
  if (!result.credentialId) {
    throw new Error("Passkey registration did not return a credential");
  }

  const now = new Date().toISOString();

  return {
    id: result.id ?? result.credentialId,
    label: result.label ?? fallbackLabel,
    credentialId: result.credentialId,
    transports: result.transports ?? ["internal"],
    createdAt: result.createdAt ?? now,
    lastUsedAt: result.lastUsedAt ?? result.createdAt ?? now,
    status: result.status ?? "active",
  };
}

export async function authenticatePasskey(
  identifier?: string,
): Promise<AuthLoginResponse> {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkey login is not available in this browser");
  }

  const trimmedIdentifier = identifier?.trim();
  const options = await api.webAuthnAuthenticationOptions({
    email: trimmedIdentifier?.includes("@")
      ? trimmedIdentifier.toLowerCase()
      : undefined,
  });

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToArrayBuffer(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: options.allowCredentials?.map((item) => ({
        ...item,
        id: base64UrlToArrayBuffer(item.id),
      })),
      userVerification: options.userVerification,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey login was cancelled");
  }

  return api.completeWebAuthnAuthentication({
    assertion: serializePublicKeyCredential(credential),
  });
}

export async function completeMfaPasskey(
  challenge: AuthMfaChallenge,
): Promise<AuthLoginResponse> {
  if (!challenge.challengeToken || !challenge.challengeId) {
    throw new Error("MFA challenge has not been started");
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error("Passkey verification is not available in this browser");
  }

  const options = getMfaWebAuthnOptions(challenge);
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToArrayBuffer(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: options.allowCredentials?.map((item) => ({
        ...item,
        id: base64UrlToArrayBuffer(item.id),
      })),
      userVerification: options.userVerification,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey verification was cancelled");
  }

  return api.completeMfaLogin({
    challengeToken: challenge.challengeToken,
    challengeId: challenge.challengeId,
    assertion: serializePublicKeyCredential(credential),
  });
}

function getMfaWebAuthnOptions(
  challenge: AuthMfaChallenge,
): WebAuthnAuthenticationOptions {
  const metadata = challenge.mfaChallengeMetadata;
  const options = metadata?.options;

  if (!isWebAuthnAuthenticationOptions(options)) {
    throw new Error("Passkey challenge options are unavailable");
  }

  return options;
}

function isWebAuthnAuthenticationOptions(
  value: unknown,
): value is WebAuthnAuthenticationOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "challenge" in value &&
    typeof (value as { challenge?: unknown }).challenge === "string"
  );
}

function serializePublicKeyCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle
        ? arrayBufferToBase64Url(response.userHandle)
        : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function serializeAttestationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  const transports: AuthenticatorTransport[] =
    typeof response.getTransports === "function"
      ? (response.getTransports() as AuthenticatorTransport[])
      : ["internal"];

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      transports,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
