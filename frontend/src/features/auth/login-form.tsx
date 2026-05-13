"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Fingerprint,
  Mail,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLoader } from "@/components/ui/brand-loader";
import { OtpCodeInput } from "@/features/auth/otp-code-input";
import { api } from "@/lib/api-client";
import { persistAuthSession } from "@/lib/auth-session";
import {
  isUgandaPhoneNumber,
  normalizeUgandaPhoneInput,
} from "@/lib/uganda-phone";
import { authenticatePasskey, completeMfaPasskey } from "@/lib/webauthn";
import type {
  AuthLoginResult,
  AuthLoginMethod,
  AuthLoginResponse,
  AuthMfaChallenge,
} from "@/types/domain";

type LoginMethod = AuthLoginMethod;
type MfaMethod = NonNullable<AuthMfaChallenge["mfaMethod"]>;

type OtpIdentifierValidationResult = Readonly<{
  normalized: string | null;
  kind: "phone" | "email" | "tin" | null;
  isValid: boolean;
  message?: string;
}>;

function validateOtpIdentifier(raw: string): OtpIdentifierValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      normalized: null,
      kind: null,
      isValid: false,
      message: "Phone number, email, or TIN is required",
    };
  }

  const normalizedPhone = normalizeUgandaPhoneInput(trimmed);
  if (isUgandaPhoneNumber(normalizedPhone)) {
    return {
      normalized: normalizedPhone,
      kind: "phone",
      isValid: true,
    };
  }

  const normalizedEmail = trimmed.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      normalized: normalizedEmail,
      kind: "email",
      isValid: true,
    };
  }

  const tinDigits = trimmed.replace(/\D/g, "");
  if (tinDigits.length === 10) {
    return {
      normalized: tinDigits,
      kind: "tin",
      isValid: true,
    };
  }

  return {
    normalized: null,
    kind: null,
    isValid: false,
    message: "Use a valid Uganda phone number, email address, or 10-digit TIN",
  };
}

const loginMethodStorageKey = "mtn-bds-last-login-method";
const loginMethodChangeEvent = "mtn-bds-login-method-change";
const liveApiEnabled = process.env.NEXT_PUBLIC_API_MODE === "live";
const defaultLoginMethod: LoginMethod = liveApiEnabled ? "password" : "otp";
const loginMethodOptions = [
  { key: "otp", label: "OTP login", icon: MessageSquare },
  { key: "password", label: "Password", icon: UserRoundCheck },
  { key: "passkey", label: "Passkey", icon: Fingerprint },
] as const;
const mfaMethodOptions: Record<
  MfaMethod,
  {
    label: string;
    description: string;
    icon: typeof Mail;
  }
> = {
  "email-otp": {
    label: "Email code",
    description: "Send a 5-digit code to your email.",
    icon: Mail,
  },
  "sms-otp": {
    label: "SMS code",
    description: "Send a 5-digit code to your phone.",
    icon: Smartphone,
  },
  totp: {
    label: "Authenticator app",
    description: "Use Google Authenticator or Microsoft Authenticator.",
    icon: ShieldCheck,
  },
  webauthn: {
    label: "Passkey",
    description: "Use fingerprint, face unlock, or your device lock.",
    icon: Fingerprint,
  },
  "recovery-code": {
    label: "Recovery code",
    description: "Use one saved recovery code.",
    icon: ShieldCheck,
  },
};

function isLoginMethod(value: string | null): value is LoginMethod {
  return value === "password" || value === "otp" || value === "passkey";
}

function rememberLoginMethod(method: LoginMethod) {
  window.localStorage.setItem(loginMethodStorageKey, method);
  window.dispatchEvent(new Event(loginMethodChangeEvent));
}

function redirectToTarget(target: string) {
  window.location.assign(target);
}

function isMfaChallenge(result: AuthLoginResponse): result is AuthMfaChallenge {
  return result.mfaRequired === true;
}

function isMfaSelectionPending(challenge: AuthMfaChallenge) {
  return Boolean(
    challenge.mfaSelectionToken &&
    !challenge.challengeToken &&
    !challenge.challengeId,
  );
}

function getAvailableMfaMethods(challenge: AuthMfaChallenge): MfaMethod[] {
  const methods = challenge.availableMfaMethods?.length
    ? challenge.availableMfaMethods
    : [challenge.preferredMfaMethod ?? challenge.mfaMethod ?? "email-otp"];

  return methods.filter(
    (method, index, list) => list.indexOf(method) === index,
  );
}

function getMfaCodeLength(method: MfaMethod) {
  return method === "totp" ? 6 : 5;
}

function getMfaStatusMessage(method: MfaMethod) {
  if (method === "email-otp") {
    return "Enter the 5-digit code sent to your email.";
  }

  if (method === "sms-otp") {
    return "Enter the 5-digit code sent to your phone.";
  }

  if (method === "totp") {
    return "Enter the 6-digit code from your authenticator app.";
  }

  if (method === "webauthn") {
    return "Use fingerprint, face unlock, or your device lock to continue.";
  }

  return "Enter one of your saved recovery codes.";
}

function getStoredLoginMethod(): LoginMethod {
  if (typeof window === "undefined") {
    return defaultLoginMethod;
  }

  const savedMethod = window.localStorage.getItem(loginMethodStorageKey);

  return isLoginMethod(savedMethod) ? savedMethod : defaultLoginMethod;
}

function subscribeToStoredLoginMethod(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(loginMethodChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(loginMethodChangeEvent, onStoreChange);
  };
}

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<AuthMfaChallenge | null>(
    null,
  );
  const [selectedMfaMethod, setSelectedMfaMethod] =
    useState<MfaMethod>("email-otp");
  const loginMethod = useSyncExternalStore(
    subscribeToStoredLoginMethod,
    getStoredLoginMethod,
    () => defaultLoginMethod,
  );
  const [passwordlessSetupOpen, setPasswordlessSetupOpen] = useState(false);
  const [successfulLogin, setSuccessfulLogin] =
    useState<AuthLoginResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const validatedIdentifier = useMemo(
    () => validateOtpIdentifier(identifier),
    [identifier],
  );
  const identifierError =
    identifier.trim() && !validatedIdentifier.isValid
      ? validatedIdentifier.message
      : null;
  const passwordlessSetupPrompt = successfulLogin?.passwordlessSetupPrompt;
  const activeMfaMethod = mfaChallenge?.mfaMethod ?? selectedMfaMethod;
  const availableMfaMethods = mfaChallenge
    ? getAvailableMfaMethods(mfaChallenge)
    : [];
  const mfaCodeLength = getMfaCodeLength(activeMfaMethod);

  useEffect(() => {
    if (loginMethod !== "otp" || !otpSent) {
      return;
    }

    const credentialsApi = navigator.credentials as
      | (CredentialsContainer & {
          get?: (options?: unknown) => Promise<{ code?: string } | null>;
        })
      | undefined;

    if (
      typeof window === "undefined" ||
      !("OTPCredential" in window) ||
      typeof credentialsApi?.get !== "function"
    ) {
      return;
    }

    const abortController = new AbortController();

    void credentialsApi
      .get({
        otp: { transport: ["sms"] },
        signal: abortController.signal,
      })
      .then((credential) => {
        const code = credential?.code?.replace(/\D/g, "").slice(0, 6) ?? "";
        if (code) {
          setOtp(code);
        }
      })
      .catch(() => {
        // Ignore when WebOTP is unavailable, denied, or aborted.
      });

    return () => {
      abortController.abort();
    };
  }, [loginMethod, otpSent]);

  const selectLoginMethod = (method: LoginMethod) => {
    rememberLoginMethod(method);
    setStatusMessage(null);
    setMfaChallenge(null);
    setMfaCode("");
    setSelectedMfaMethod("email-otp");

    if (method !== "otp") {
      setOtp("");
      setOtpSent(false);
    }
  };

  const completeAuthenticatedLogin = (
    result: AuthLoginResult,
    methodToRemember?: LoginMethod,
  ) => {
    persistAuthSession(result);
    if (methodToRemember) {
      rememberLoginMethod(methodToRemember);
    }
    setSuccessfulLogin(result);
    setMfaChallenge(null);
    setMfaCode("");
    setSelectedMfaMethod("email-otp");

    if (result.promptPasswordlessSetup && result.passwordlessSetupPrompt) {
      setPasswordlessSetupOpen(true);
      return;
    }

    redirectToTarget(result.nextRoute);
  };

  const completeLogin = async (payload: Parameters<typeof api.login>[0]) => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const result = await api.login(payload);

      if (isMfaChallenge(result)) {
        const methods = getAvailableMfaMethods(result);
        const nextMethod =
          result.preferredMfaMethod ??
          result.mfaMethod ??
          methods[0] ??
          "email-otp";
        setMfaChallenge(result);
        setMfaCode("");
        setSelectedMfaMethod(nextMethod);
        setStatusMessage(
          isMfaSelectionPending(result)
            ? "Choose a verification method."
            : getMfaStatusMessage(nextMethod),
        );
        return;
      }

      completeAuthenticatedLogin(result, payload.method);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Sign-in failed. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (mfaChallenge) {
      setIsSubmitting(true);
      setStatusMessage(null);

      try {
        if (isMfaSelectionPending(mfaChallenge)) {
          if (!mfaChallenge.mfaSelectionToken) {
            throw new Error("MFA selection has expired. Sign in again.");
          }

          const result = await api.startMfaLoginChallenge({
            selectionToken: mfaChallenge.mfaSelectionToken,
            mfaMethod: selectedMfaMethod,
          });

          setMfaChallenge(result);
          setMfaCode("");
          setSelectedMfaMethod(result.mfaMethod ?? selectedMfaMethod);
          setStatusMessage(
            getMfaStatusMessage(result.mfaMethod ?? selectedMfaMethod),
          );
          return;
        }

        if (!mfaChallenge.challengeToken || !mfaChallenge.challengeId) {
          throw new Error("MFA challenge has expired. Sign in again.");
        }

        const activeMfaMethod = mfaChallenge.mfaMethod ?? selectedMfaMethod;
        const codeLength = getMfaCodeLength(activeMfaMethod);
        let result: AuthLoginResponse;

        if (activeMfaMethod === "webauthn") {
          result = await completeMfaPasskey(mfaChallenge);
        } else if (activeMfaMethod === "recovery-code") {
          if (!mfaCode.trim()) {
            throw new Error("Enter a recovery code.");
          }

          result = await api.completeMfaLogin({
            challengeToken: mfaChallenge.challengeToken,
            challengeId: mfaChallenge.challengeId,
            recoveryCode: mfaCode.trim(),
          });
        } else {
          if (!new RegExp(`^\\d{${codeLength}}$`).test(mfaCode.trim())) {
            throw new Error(
              `Enter the ${codeLength}-digit authentication code.`,
            );
          }

          result = await api.completeMfaLogin({
            challengeToken: mfaChallenge.challengeToken,
            challengeId: mfaChallenge.challengeId,
            code: mfaCode.trim(),
          });
        }

        if (isMfaChallenge(result)) {
          const methods = getAvailableMfaMethods(result);
          const nextMethod =
            result.preferredMfaMethod ??
            result.mfaMethod ??
            methods[0] ??
            "email-otp";
          setMfaChallenge(result);
          setMfaCode("");
          setSelectedMfaMethod(nextMethod);
          setStatusMessage(
            isMfaSelectionPending(result)
              ? "Choose a verification method."
              : getMfaStatusMessage(nextMethod),
          );
          return;
        }

        completeAuthenticatedLogin(result, "password");
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "Verification failed. Try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (loginMethod === "passkey") {
      if (liveApiEnabled) {
        setIsSubmitting(true);
        setStatusMessage(null);

        try {
          const result = await authenticatePasskey();

          if (isMfaChallenge(result)) {
            const methods = getAvailableMfaMethods(result);
            const nextMethod =
              result.preferredMfaMethod ??
              result.mfaMethod ??
              methods[0] ??
              "email-otp";
            setMfaChallenge(result);
            setMfaCode("");
            setSelectedMfaMethod(nextMethod);
            setStatusMessage(
              isMfaSelectionPending(result)
                ? "Choose a verification method."
                : getMfaStatusMessage(nextMethod),
            );
            return;
          }

          completeAuthenticatedLogin(result, "passkey");
        } catch (error) {
          setStatusMessage(
            error instanceof Error ? error.message : "Passkey sign-in failed.",
          );
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      await completeLogin({
        method: "passkey",
        credentialId: "credential-ops-laptop",
      });
      return;
    }

    if (loginMethod === "password") {
      const identifier = accountEmail.trim().toLowerCase();

      if (!identifier || !accountPassword) {
        setStatusMessage(
          "Username, email, or phone number and password are required.",
        );
        return;
      }

      await completeLogin({
        method: "password",
        email: identifier.includes("@") ? identifier : undefined,
        phoneNumber: /^\+?\d{9,15}$/.test(identifier) ? identifier : undefined,
        username: identifier,
        password: accountPassword,
      });
      return;
    }

    if (!validatedIdentifier.isValid || !validatedIdentifier.normalized) {
      setStatusMessage(
        validatedIdentifier.message ??
          "Enter a valid phone number, email, or TIN",
      );
      return;
    }

    const normalizedIdentifier = validatedIdentifier.normalized;
    setIdentifier(normalizedIdentifier);

    if (!otpSent) {
      setOtpSent(true);
      setStatusMessage(
        "OTP sent. Enter the code we just sent to continue signing in.",
      );
      return;
    }

    if (!otp.trim()) {
      setStatusMessage("Enter the one-time code to complete sign-in.");
      return;
    }

    await completeLogin({
      method: "otp",
      identifier: normalizedIdentifier,
      identifierKind: validatedIdentifier.kind ?? undefined,
      otp: otp.trim(),
    });
  };

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          {loginMethodOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => selectLoginMethod(option.key)}
              aria-label={option.label}
              title={option.label}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border transition-colors ${
                loginMethod === option.key
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white/52 text-black/62 hover:bg-white/72"
              }`}
            >
              <option.icon className="h-4.5 w-4.5" />
            </button>
          ))}
        </div>

        <div className="grid min-h-[13rem] content-center gap-3">
          {mfaChallenge ? (
            <>
              {isMfaSelectionPending(mfaChallenge) ? (
                <>
                  <label className="block text-center text-xs font-medium text-black/66">
                    Choose Verification Method
                  </label>
                  <div className="grid gap-2">
                    {availableMfaMethods.map((method) => {
                      const option = mfaMethodOptions[method];

                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setSelectedMfaMethod(method);
                            setStatusMessage(null);
                          }}
                          className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                            selectedMfaMethod === method
                              ? "border-black bg-black text-white"
                              : "border-white/28 bg-white/18 text-black hover:bg-white/34"
                          }`}
                        >
                          <option.icon className="h-4.5 w-4.5 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                              {option.label}
                            </span>
                            <span
                              className={`block text-xs ${
                                selectedMfaMethod === method
                                  ? "text-white/72"
                                  : "text-black/56"
                              }`}
                            >
                              {option.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : activeMfaMethod === "webauthn" ? (
                <div className="rounded-xl border border-white/28 bg-white/18 p-3 text-center text-sm text-black/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
                  Use fingerprint, face unlock, or your device lock to continue.
                </div>
              ) : activeMfaMethod === "recovery-code" ? (
                <>
                  <label className="block text-center text-xs font-medium text-black/66">
                    Recovery Code
                  </label>
                  <input
                    className="h-11 w-full rounded-xl border border-white/28 bg-white/18 px-3 py-2 text-center text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl placeholder:text-center placeholder:text-black/40"
                    type="text"
                    autoComplete="one-time-code"
                    placeholder="BDS-XXXX-XXXX"
                    value={mfaCode}
                    onChange={(event) => {
                      setMfaCode(event.target.value);
                      setStatusMessage(null);
                    }}
                  />
                </>
              ) : (
                <>
                  <label className="block text-center text-xs font-medium text-black/66">
                    {mfaMethodOptions[activeMfaMethod].label}
                  </label>
                  <OtpCodeInput
                    value={mfaCode}
                    onChange={setMfaCode}
                    length={mfaCodeLength}
                    className="px-0 py-1"
                    inputClassName="h-11 w-11 rounded-xl border border-white/28 bg-white/18 text-center text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                  />
                  <p className="text-center text-xs text-black/56">
                    {getMfaStatusMessage(activeMfaMethod)}
                  </p>
                </>
              )}
            </>
          ) : loginMethod === "otp" ? (
            <>
              <label className="block text-center text-xs font-medium text-black/66">
                Phone Number, Email, or TIN
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/28 bg-white/18 px-3 py-2 text-center text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl placeholder:text-center placeholder:text-black/40"
                placeholder="Enter phone number, email, or TIN"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setStatusMessage(null);
                  if (otpSent) {
                    setOtpSent(false);
                    setOtp("");
                  }
                }}
              />
              {identifierError && (
                <p className="text-xs text-destructive">{identifierError}</p>
              )}
              {!otpSent ? (
                <p className="text-center text-xs text-black/56">
                  Tap sign in to request your one-time code.
                </p>
              ) : null}

              {otpSent && (
                <>
                  <label className="block text-center text-xs font-medium text-black/66">
                    OTP Code
                  </label>
                  <OtpCodeInput
                    value={otp}
                    onChange={setOtp}
                    length={5}
                    className="px-0 py-1"
                    inputClassName="h-11 w-11 rounded-xl border border-white/28 bg-white/18 text-center text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl"
                  />
                  <p className="text-center text-xs text-black/56">
                    We can fill the code automatically from SMS where supported.
                    Email codes may also appear as suggestions on your device.
                  </p>
                </>
              )}
            </>
          ) : loginMethod === "passkey" ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/28 bg-white/18 p-4 text-center text-sm text-black/64 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
                <Fingerprint className="h-6 w-6" />
              </span>
              <span>Use fingerprint, face unlock, or your device lock.</span>
            </div>
          ) : (
            <>
              <label className="block text-center text-xs font-medium text-black/66">
                Username, Email, or Phone
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/28 bg-white/18 px-3 py-2 text-center text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl placeholder:text-center placeholder:text-black/40"
                type="text"
                inputMode="text"
                autoComplete="username"
                placeholder="Enter username, email, or phone"
                value={accountEmail}
                onChange={(event) => {
                  setAccountEmail(event.target.value);
                  setStatusMessage(null);
                }}
              />
              <label className="block text-center text-xs font-medium text-black/66">
                Password
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/28 bg-white/18 px-3 py-2 text-center text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl placeholder:text-center placeholder:text-black/40"
                type="password"
                autoComplete="current-password"
                placeholder="Enter password"
                value={accountPassword}
                onChange={(event) => {
                  setAccountPassword(event.target.value);
                  setStatusMessage(null);
                }}
              />
              <p className="text-center text-xs text-black/56">
                Enter your password, then complete verification if required.
              </p>
            </>
          )}
        </div>

        <div
          aria-live="polite"
          className="flex min-h-9 items-center justify-center"
        >
          {statusMessage && (
            <p className="text-center text-xs text-black/64">{statusMessage}</p>
          )}
        </div>

        <button
          className="h-11 w-full rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(15,23,42,0.16)] transition-colors hover:bg-black/92 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
        >
          {mfaChallenge
            ? isMfaSelectionPending(mfaChallenge)
              ? isSubmitting
                ? "Starting verification..."
                : `Use ${mfaMethodOptions[selectedMfaMethod].label}`
              : activeMfaMethod === "webauthn"
                ? isSubmitting
                  ? "Checking passkey..."
                  : "Use passkey"
                : isSubmitting
                  ? "Verifying..."
                  : activeMfaMethod === "recovery-code"
                    ? "Verify recovery code"
                    : "Verify code"
            : loginMethod === "passkey"
              ? isSubmitting
                ? "Checking passkey..."
                : "Use passkey"
              : loginMethod === "password"
                ? isSubmitting
                  ? "Signing in..."
                  : "Sign in"
                : otpSent
                  ? isSubmitting
                    ? "Verifying..."
                    : "Verify OTP"
                  : "Request OTP"}
        </button>
      </form>

      {isSubmitting && <BrandLoader overlay label="Signing you in" />}

      <Dialog
        open={passwordlessSetupOpen}
        onOpenChange={setPasswordlessSetupOpen}
      >
        <DialogContent
          showCloseButton={false}
          className="max-w-md rounded-[1.4rem] border border-white/30 bg-white/92 p-0 text-black shadow-[0_24px_60px_rgba(15,23,42,0.2)] backdrop-blur-xl"
        >
          <div className="space-y-5 p-5">
            <DialogHeader className="space-y-2 text-left">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl text-black">
                {passwordlessSetupPrompt?.title ?? "Set up passwordless login"}
              </DialogTitle>
              <DialogDescription className="text-black/62">
                {passwordlessSetupPrompt?.message ??
                  "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-[1rem] border border-black/8 bg-black/[0.035] p-4 text-sm text-black/70">
              You are signed in. You can set up a passkey now from Security, or
              continue and do it later.
            </div>

            <DialogFooter>
              <button
                type="button"
                className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-black/[0.04]"
                onClick={() => {
                  if (successfulLogin) {
                    redirectToTarget(successfulLogin.nextRoute);
                  }
                }}
              >
                Later
              </button>
              <button
                type="button"
                className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-black/90"
                onClick={() => {
                  const target =
                    passwordlessSetupPrompt?.setupUrl ??
                    successfulLogin?.nextRoute ??
                    "/console";
                  redirectToTarget(target);
                }}
              >
                <Fingerprint className="mr-2 inline h-4 w-4" />
                Set up passkey
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
