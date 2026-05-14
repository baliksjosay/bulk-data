"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Mail, MessageSquare } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/ui/brand-loader";
import { Input } from "@/components/ui/input";
import { OtpCodeInput } from "@/features/auth/otp-code-input";
import { AuthPageShell } from "@/features/auth/auth-page-shell";
import { PasskeySetupPrompt } from "@/features/auth/passkey-setup-prompt";
import { ApiClientError, api } from "@/lib/api-client";
import { persistAuthSession } from "@/lib/auth-session";
import {
  isUgandaPhoneNumber,
  normalizeUgandaPhoneInput,
} from "@/lib/uganda-phone";
import type {
  AccountActivationOtpResult,
  AccountActivationOtpVerificationResult,
  AuthLoginResult,
} from "@/types/domain";

type DeliveryChannel = "email" | "sms";

const passwordPolicyItems = [
  "At least 14 characters",
  "Uppercase and lowercase letters",
  "Number and special character",
];

function normalizeIdentifier(value: string, channel: DeliveryChannel) {
  return channel === "sms"
    ? normalizeUgandaPhoneInput(value)
    : value.trim().toLowerCase();
}

function isValidIdentifier(value: string, channel: DeliveryChannel) {
  if (channel === "sms") {
    return isUgandaPhoneNumber(normalizeUgandaPhoneInput(value));
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Request failed";
}

export function ActivationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [identifier, setIdentifier] = useState("");
  const [deliveryChannel, setDeliveryChannel] =
    useState<DeliveryChannel>("email");
  const [otpResult, setOtpResult] =
    useState<AccountActivationOtpResult | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<AccountActivationOtpVerificationResult | null>(null);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successfulLogin, setSuccessfulLogin] =
    useState<AuthLoginResult | null>(null);
  const [passkeyPromptOpen, setPasskeyPromptOpen] = useState(false);

  const normalizedIdentifier = useMemo(
    () => normalizeIdentifier(identifier, deliveryChannel),
    [deliveryChannel, identifier],
  );
  const identifierIsValid = isValidIdentifier(identifier, deliveryChannel);
  const destinationLabel =
    deliveryChannel === "email" ? "Email address" : "Phone number";

  const redirectTo = (target: string) => {
    setPasskeyPromptOpen(false);
    router.push(target as Route);
  };

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!token) {
      setErrorMessage("Activation link is missing.");
      return;
    }

    if (!identifierIsValid) {
      setErrorMessage(`Enter the ${destinationLabel.toLowerCase()} on the account.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.startAccountActivationOtp({
        token,
        identifier: normalizedIdentifier,
        deliveryChannel,
      });
      setOtpResult(result);
      setOtp("");
      setStatusMessage(
        `Code sent to ${result.maskedDestination ?? result.maskedEmail}.`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyOtp() {
    if (!otpResult || otp.length !== 5) {
      setErrorMessage("Enter the 5-digit code.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await api.verifyAccountActivationOtp({
        token,
        activationId: otpResult.activationId,
        otp,
      });
      setVerificationResult(result);
      setStatusMessage("Code verified. Create your password to continue.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function completeActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!verificationResult) {
      setErrorMessage("Verify the activation code first.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords must match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await api.completeAccountActivationPassword({
        passwordSetupToken: verificationResult.passwordSetupToken,
        password,
        confirmPassword,
      });
      persistAuthSession(result);
      setSuccessfulLogin(result);
      setStatusMessage("Account activated successfully.");
      if (result.promptPasswordlessSetup && result.passwordlessSetupPrompt) {
        setPasskeyPromptOpen(true);
      } else {
        redirectTo(result.nextRoute);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      title="Activate account"
      description="Confirm your registered contact, create your password, and continue to the portal."
      aside={<p>Customer access starts after account activation.</p>}
    >
      <div className="space-y-5">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-black">
            Customer activation
          </h2>
          <p className="text-sm text-black/62">
            Use the contact details captured for your business account.
          </p>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-950">
            <CheckCircle2 className="h-4 w-4" />
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-950">
            {errorMessage}
          </div>
        )}

        <form className="space-y-4" onSubmit={requestOtp}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["email", "sms"] as const).map((channel) => {
              const Icon = channel === "email" ? Mail : MessageSquare;
              const selected = deliveryChannel === channel;

              return (
                <button
                  key={channel}
                  type="button"
                  className={[
                    "flex min-h-16 items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                    selected
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white/80 text-black hover:bg-black/[0.04]",
                  ].join(" ")}
                  onClick={() => {
                    setDeliveryChannel(channel);
                    setOtpResult(null);
                    setVerificationResult(null);
                    setOtp("");
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {channel === "email" ? "Send to email" : "Send by SMS"}
                    </span>
                    <span className="block text-xs opacity-70">
                      {channel === "email"
                        ? "Use the registered email"
                        : "Use the registered phone"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="block space-y-2 text-sm font-medium text-black">
            {destinationLabel}
            <input
              className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-black/45"
              type={deliveryChannel === "email" ? "email" : "tel"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={
                deliveryChannel === "email"
                  ? "name@example.com"
                  : "+25677XXXXXXX"
              }
              autoComplete={deliveryChannel === "email" ? "email" : "tel"}
            />
          </label>

          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={isSubmitting || !identifierIsValid}
          >
            {isSubmitting ? "Sending code..." : "Send code"}
          </Button>
        </form>

        {otpResult && !verificationResult && (
          <div className="space-y-4 rounded-2xl border border-black/10 bg-white/72 p-4">
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold text-black">
                Enter activation code
              </p>
              <p className="text-xs text-black/58">
                Sent to {otpResult.maskedDestination ?? otpResult.maskedEmail}
              </p>
            </div>
            <OtpCodeInput value={otp} onChange={setOtp} length={5} />
            <Button
              type="button"
              className="h-11 w-full rounded-xl"
              disabled={isSubmitting || otp.length !== 5}
              onClick={verifyOtp}
            >
              {isSubmitting ? "Verifying..." : "Verify code"}
            </Button>
          </div>
        )}

        {verificationResult && (
          <form
            className="space-y-4 rounded-2xl border border-black/10 bg-white/72 p-4"
            onSubmit={completeActivation}
          >
            <div>
              <p className="text-sm font-semibold text-black">Create password</p>
              <div className="mt-2 grid gap-1 text-xs text-black/62 sm:grid-cols-3">
                {passwordPolicyItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <label className="block space-y-2 text-sm font-medium text-black">
              Password
              <Input
                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-black/45"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-black">
              Confirm password
              <Input
                className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-black/45"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl"
              disabled={isSubmitting || !password || !confirmPassword}
            >
              {isSubmitting ? "Activating..." : "Activate account"}
            </Button>
          </form>
        )}
      </div>

      {isSubmitting && <BrandLoader overlay label="Processing activation" />}

      <PasskeySetupPrompt
        open={passkeyPromptOpen}
        onOpenChange={setPasskeyPromptOpen}
        loginResult={successfulLogin}
        onContinue={redirectTo}
      />
    </AuthPageShell>
  );
}
