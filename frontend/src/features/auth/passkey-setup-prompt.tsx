"use client";

import { useState } from "react";
import { AlertCircle, Fingerprint, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { registerPasskey } from "@/lib/webauthn";
import type { AuthLoginResult } from "@/types/domain";

type PasskeySetupPromptProps = Readonly<{
  loginResult: AuthLoginResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (target: string) => void;
}>;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Passkey setup failed. Try again from Security.";
}

export function PasskeySetupPrompt({
  loginResult,
  open,
  onOpenChange,
  onContinue,
}: PasskeySetupPromptProps) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const prompt = loginResult?.passwordlessSetupPrompt;

  const continueToDashboard = () => {
    if (!loginResult) {
      onOpenChange(false);
      return;
    }

    setSetupError(null);
    onOpenChange(false);
    onContinue(loginResult.nextRoute);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSettingUp) {
      return;
    }

    if (!nextOpen) {
      continueToDashboard();
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleSetUpPasskey = async () => {
    if (!loginResult) {
      return;
    }

    setSetupError(null);
    setIsSettingUp(true);

    try {
      await registerPasskey("This device");
      onOpenChange(false);
      onContinue(loginResult.nextRoute);
    } catch (error) {
      setSetupError(getErrorMessage(error));
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              {prompt?.title ?? "Set up faster sign-in"}
            </DialogTitle>
            <DialogDescription className="text-black/62">
              {prompt?.message ??
                "Use fingerprint, face unlock, or your device PIN for faster sign-in next time."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[1rem] border border-black/8 bg-black/[0.035] p-4 text-sm text-black/70">
            {isSettingUp
              ? "Follow your browser prompt to finish setup."
              : "You are signed in. Set this up now, or continue and do it later from Security."}
          </div>

          {setupError && (
            <div className="flex gap-2 rounded-[1rem] border border-red-500/25 bg-red-500/10 p-3 text-sm font-medium text-red-950">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{setupError}</span>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSettingUp}
              onClick={continueToDashboard}
            >
              Later
            </button>
            <button
              type="button"
              className="h-10 rounded-xl bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSettingUp || !loginResult}
              onClick={handleSetUpPasskey}
            >
              <Fingerprint className="mr-2 inline h-4 w-4" />
              {isSettingUp ? "Setting up..." : "Set up now"}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
