"use client";

import { useState } from "react";
import { Fingerprint, Mail, ShieldCheck, Smartphone } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/ui/brand-loader";
import { Input } from "@/components/ui/input";
import { OtpCodeInput } from "@/features/auth/otp-code-input";
import { PasskeySetupPrompt } from "@/features/auth/passkey-setup-prompt";
import { ApiClientError, api } from "@/lib/api-client";
import { clearAuthSession, persistAuthSession } from "@/lib/auth-session";
import { beginSocialPopupLogin } from "@/lib/social-auth";
import { authenticatePasskey, completeMfaPasskey } from "@/lib/webauthn";
import type {
  AuthLoginResult,
  AuthLoginResponse,
  AuthMfaChallenge,
  SocialLoginProvider,
} from "@/types/domain";

type LoginMethod = "password" | "passkey";
type MfaMethod = NonNullable<AuthMfaChallenge["mfaMethod"]>;

const loginMethodStorageKey = "mtn-bds-last-login-method";
const liveApiEnabled = process.env.NEXT_PUBLIC_API_MODE === "live";
const googleSsoConfigured = Boolean(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim(),
);
const microsoftSsoConfigured = Boolean(
  process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID?.trim(),
);
const ssoConfigured = googleSsoConfigured || microsoftSsoConfigured;
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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4.5 w-4.5" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3.1l3.1 2.4c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.4-.2-2H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.5 0 4.6-.8 6.1-2.3l-3.1-2.4c-.9.6-1.9 1-3 1-2.3 0-4.2-1.5-4.8-3.6H4v2.5A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M7.2 14.7A6 6 0 0 1 6.9 13c0-.6.1-1.2.3-1.7V8.8H4A10 10 0 0 0 2.9 13c0 1.6.4 3.1 1.1 4.5l3.2-2.8Z"
      />
      <path
        fill="#FBBC05"
        d="M12 7.7c1.3 0 2.5.5 3.4 1.4l2.6-2.6C16.6 5.2 14.5 4.3 12 4.3A10 10 0 0 0 4 8.8l3.2 2.5c.6-2.1 2.5-3.6 4.8-3.6Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg aria-hidden="true" className="h-4.5 w-4.5" viewBox="0 0 24 24">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

function rememberLoginMethod(method: LoginMethod) {
  window.localStorage.setItem(loginMethodStorageKey, method);
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

export function LoginForm() {
  const router = useRouter();
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<AuthMfaChallenge | null>(
    null,
  );
  const [selectedMfaMethod, setSelectedMfaMethod] =
    useState<MfaMethod>("email-otp");
  const [passwordlessSetupOpen, setPasswordlessSetupOpen] = useState(false);
  const [successfulLogin, setSuccessfulLogin] =
    useState<AuthLoginResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSocialProvider, setActiveSocialProvider] =
    useState<SocialLoginProvider | null>(null);
  const activeMfaMethod = mfaChallenge?.mfaMethod ?? selectedMfaMethod;
  const availableMfaMethods = mfaChallenge
    ? getAvailableMfaMethods(mfaChallenge)
    : [];
  const mfaCodeLength = getMfaCodeLength(activeMfaMethod);

  const redirectToTarget = (target: string) => {
    setPasswordlessSetupOpen(false);
    router.replace(target as Route);
  };

  const redirectActiveSession = async () => {
    try {
      const session = await api.currentAuthSession();

      persistAuthSession(session);
      redirectToTarget(session.nextRoute);
      return true;
    } catch {
      clearAuthSession();
      return false;
    }
  };

  const startSelectedMfaChallenge = async (
    selectionToken: string,
    method: MfaMethod,
  ) => {
    const result = await api.startMfaLoginChallenge({
      selectionToken,
      mfaMethod: method,
    });
    const nextMethod = result.mfaMethod ?? method;

    setMfaChallenge({
      ...result,
      mfaSelectionToken: selectionToken,
    });
    setMfaCode("");
    setSelectedMfaMethod(nextMethod);
    setStatusMessage(getMfaStatusMessage(nextMethod));
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

  const continueWithAuthResponse = (
    result: AuthLoginResponse,
    methodToRemember?: LoginMethod,
  ) => {
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

    completeAuthenticatedLogin(result, methodToRemember);
  };

  const completeLogin = async (payload: Parameters<typeof api.login>[0]) => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (await redirectActiveSession()) {
        return;
      }

      const result = await api.login(payload);

      continueWithAuthResponse(
        result,
        payload.method === "passkey" ? "passkey" : "password",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Sign-in failed. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: SocialLoginProvider) => {
    setIsSubmitting(true);
    setActiveSocialProvider(provider);
    setStatusMessage(null);
    setMfaChallenge(null);
    setMfaCode("");

    try {
      if (!liveApiEnabled) {
        throw new Error("SSO sign-in requires live API mode.");
      }

      if (await redirectActiveSession()) {
        return;
      }

      const { idToken } = await beginSocialPopupLogin(provider);
      const result =
        provider === "google"
          ? await api.loginWithGoogleIdToken({ idToken })
          : await api.loginWithMicrosoftIdToken({ idToken });

      continueWithAuthResponse(result);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "SSO sign-in failed. Try again.",
      );
    } finally {
      setActiveSocialProvider(null);
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setStatusMessage(null);
    setMfaChallenge(null);
    setMfaCode("");
    setSelectedMfaMethod("email-otp");

    if (liveApiEnabled) {
      setIsSubmitting(true);

      try {
        if (await redirectActiveSession()) {
          return;
        }

        const result = await authenticatePasskey();

        continueWithAuthResponse(result, "passkey");
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

          await startSelectedMfaChallenge(
            mfaChallenge.mfaSelectionToken,
            selectedMfaMethod,
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
        if (
          error instanceof ApiClientError &&
          error.status === 401 &&
          (activeMfaMethod === "email-otp" || activeMfaMethod === "sms-otp")
        ) {
          setMfaCode("");
          setStatusMessage(
            "Code was not accepted. Use the latest code for this challenge or send a new one.",
          );
          return;
        }

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

    const identifier = accountEmail.trim().toLowerCase();

    if (!identifier || !accountPassword) {
      setIsSubmitting(true);
      setStatusMessage(null);

      try {
        if (await redirectActiveSession()) {
          return;
        }
      } finally {
        setIsSubmitting(false);
      }

      setStatusMessage(
        "TIN, phone number, email, or staff username and password are required.",
      );
      return;
    }

    await completeLogin({
      method: "password",
      identifier,
      password: accountPassword,
    });
  };

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
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
                  {(activeMfaMethod === "email-otp" ||
                    activeMfaMethod === "sms-otp") &&
                  mfaChallenge.mfaSelectionToken ? (
                    <button
                      type="button"
                      className="mx-auto text-xs font-semibold text-black underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSubmitting}
                      onClick={async () => {
                        if (!mfaChallenge.mfaSelectionToken) {
                          return;
                        }

                        setIsSubmitting(true);
                        setStatusMessage(null);

                        try {
                          await startSelectedMfaChallenge(
                            mfaChallenge.mfaSelectionToken,
                            activeMfaMethod,
                          );
                          setStatusMessage(
                            "A new code has been sent. Use the latest code.",
                          );
                        } catch (error) {
                          setStatusMessage(
                            error instanceof Error
                              ? error.message
                              : "Could not send a new code. Sign in again.",
                          );
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      Send new code
                    </button>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              <label className="block text-center text-xs font-medium text-black/66">
                TIN, Phone, Email, or Staff Username
              </label>
              <input
                className="h-11 w-full rounded-xl border border-white/28 bg-white/18 px-3 py-2 text-center text-sm text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl placeholder:text-center placeholder:text-black/40"
                type="text"
                inputMode="text"
                autoComplete="username"
                placeholder="Enter TIN, phone, email, or staff username"
                value={accountEmail}
                onChange={(event) => {
                  setAccountEmail(event.target.value);
                  setStatusMessage(null);
                }}
              />
              <label className="block text-center text-xs font-medium text-black/66">
                Password
              </label>
              <Input
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
                Customers can use TIN, phone, or email. Staff users use their AD
                username.
              </p>
              <button
                className="h-11 w-full rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(15,23,42,0.16)] transition-colors hover:bg-black/92 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
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

        {!mfaChallenge ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-[0.68rem] font-semibold uppercase text-black/42">
                or
              </span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="Continue with fingerprint, face unlock, or device lock"
                title="Use fingerprint, face unlock, or device lock"
                disabled={isSubmitting}
                onClick={() => void handlePasskeyLogin()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-black/10 bg-white/52 text-black transition-colors hover:bg-white/72 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Fingerprint className="h-4.5 w-4.5" />
              </button>

              {ssoConfigured ? (
                <>
                  <button
                    type="button"
                    aria-label="Continue with Google"
                    title={
                      googleSsoConfigured
                        ? "Continue with Google"
                        : "Google sign-in is not configured"
                    }
                    disabled={isSubmitting || !googleSsoConfigured}
                    onClick={() => void handleSocialLogin("google")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-black/10 bg-white/52 text-black transition-colors hover:bg-white/72 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GoogleIcon />
                  </button>

                  <button
                    type="button"
                    aria-label="Continue with Microsoft"
                    title={
                      microsoftSsoConfigured
                        ? "Continue with Microsoft"
                        : "Microsoft sign-in is not configured"
                    }
                    disabled={isSubmitting || !microsoftSsoConfigured}
                    onClick={() => void handleSocialLogin("microsoft")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-black/10 bg-white/52 text-black transition-colors hover:bg-white/72 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MicrosoftIcon />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {mfaChallenge ? (
          <button
            className="h-11 w-full rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(15,23,42,0.16)] transition-colors hover:bg-black/92 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isMfaSelectionPending(mfaChallenge)
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
                    : "Verify code"}
          </button>
        ) : null}
      </form>

      {isSubmitting && (
        <BrandLoader
          overlay
          overlayBackdrop={false}
          label={
            activeSocialProvider
              ? `Opening ${activeSocialProvider === "google" ? "Google" : "Microsoft"} sign in`
              : "Signing you in"
          }
        />
      )}

      <PasskeySetupPrompt
        open={passwordlessSetupOpen}
        onOpenChange={setPasswordlessSetupOpen}
        loginResult={successfulLogin}
        onContinue={redirectToTarget}
      />
    </>
  );
}
