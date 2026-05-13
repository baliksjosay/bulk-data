"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Landmark,
  Loader2,
  ReceiptText,
  Smartphone,
  WalletCards,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { formatPaymentMethod, formatUgx } from "@/lib/format";
import {
  isUgandaPhoneNumber,
  UGANDA_PHONE_COUNTRY_CODE,
} from "@/lib/uganda-phone";
import { cn } from "@/lib/utils";
import { usePaymentStore } from "@/store/payment-store";
import type {
  Customer,
  PaymentMethod,
  PaymentStatusEvent,
  PrnPaymentProvider,
  PurchaseResult,
} from "@/types/domain";

const checkoutMethods: PaymentMethod[] = [
  "mobile_money",
  "card",
  "airtime",
  "prn",
];

const statusProgress: Record<PaymentStatusEvent["status"], number> = {
  awaiting_payment: 35,
  processing: 68,
  confirmed: 100,
  failed: 100,
  expired: 100,
};

interface CheckoutBundle {
  id: string;
  name: string;
  priceUgx: number;
  serviceCode: string;
}

interface PaymentCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  primaryMsisdn: string;
  bundle: CheckoutBundle;
  provisioningCount: number;
  onPaymentComplete: () => Promise<void> | void;
}

function methodIcon(method: PaymentMethod) {
  if (method === "mobile_money") {
    return (
      <Image
        src="/logos/momo.webp"
        alt="MTN MoMo"
        width={48}
        height={32}
        className="h-8 w-auto rounded-sm"
      />
    );
  }

  if (method === "airtime") {
    return (
      <Image
        src="/logos/mtn-logo-black.svg"
        alt="MTN"
        width={48}
        height={32}
        className="h-8 w-auto rounded-sm"
        style={{ width: "auto" }}
      />
    );
  }

  if (method === "prn") {
    return <Landmark className="text-brand-foreground" />;
  }

  return <CreditCard className="text-brand-foreground" />;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border/60 bg-background/70 p-2.5">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="break-words font-medium text-foreground">{value}</span>
    </div>
  );
}

function StepHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
        {step}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        )}
      </div>
    </div>
  );
}

function PrnReference({
  prn,
  provider,
  copied,
  onCopy,
}: {
  prn: string;
  provider: string;
  copied: boolean;
  onCopy: () => Promise<void>;
}) {
  return (
    <div className="group rounded-lg border border-primary/40 bg-primary/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            <Banknote />
            PRN generated
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Use this reference with {provider}.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={() => {
            void onCopy();
          }}
        >
          <Copy />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="mt-2 rounded-md border border-primary/30 bg-background/80 px-3 py-2">
        <code className="break-all font-mono text-lg font-semibold tracking-wide text-foreground">
          {prn}
        </code>
      </div>
    </div>
  );
}

function providerLabel(provider: PrnPaymentProvider) {
  return provider === "bank" ? "Bank" : "Mobile Money";
}

function nextActionLabel(method: PaymentMethod, hasSession: boolean) {
  if (hasSession) {
    return "Listening for confirmation";
  }

  if (method === "prn") {
    return "Generate PRN";
  }

  if (method === "card") {
    return "Create card checkout";
  }

  return `Pay with ${formatPaymentMethod(method)}`;
}

function statusLabel(status?: PaymentStatusEvent["status"]) {
  if (!status) {
    return "Pending";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isTerminalStatus(status?: PaymentStatusEvent["status"]) {
  return status === "confirmed" || status === "failed" || status === "expired";
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function PaymentCheckoutDialog({
  open,
  onOpenChange,
  customer,
  primaryMsisdn,
  bundle,
  provisioningCount,
  onPaymentComplete,
}: PaymentCheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mobile_money");
  const [prnProvider, setPrnProvider] = useState<PrnPaymentProvider>("bank");
  const [autoRenew, setAutoRenew] = useState(false);
  const payingMsisdnContextKey = `${customer.id}:${primaryMsisdn}`;
  const defaultPayingMsisdn =
    primaryMsisdn || customer.phone || UGANDA_PHONE_COUNTRY_CODE;
  const [payingMsisdnState, setPayingMsisdnState] = useState({
    contextKey: payingMsisdnContextKey,
    value: defaultPayingMsisdn,
  });
  const [paymentResult, setPaymentResult] = useState<PurchaseResult | null>(
    null,
  );
  const [copiedPrn, setCopiedPrn] = useState(false);
  const trackPayment = usePaymentStore((state) => state.trackPayment);
  const trackedPayment = usePaymentStore((state) =>
    paymentResult
      ? state.payments.find(
          (payment) => payment.id === paymentResult.paymentSession.id,
        )
      : undefined,
  );
  const totalAmount = bundle.priceUgx * provisioningCount;
  const socketEvent = trackedPayment?.event ?? null;
  const socketError = trackedPayment?.errorMessage ?? "";
  const paymentFinalized = Boolean(
    trackedPayment?.finalized || isTerminalStatus(socketEvent?.status),
  );
  const isListening = Boolean(paymentResult) && !paymentFinalized;
  const requiresPayingMsisdn = paymentMethod === "mobile_money";
  const payingMsisdn =
    payingMsisdnState.contextKey === payingMsisdnContextKey
      ? payingMsisdnState.value
      : defaultPayingMsisdn;
  const progressValue = socketEvent
    ? statusProgress[socketEvent.status]
    : paymentResult
      ? 25
      : 0;

  const purchaseMutation = useMutation({
    mutationFn: api.purchaseBundle,
    onSuccess: (result) => {
      setPaymentResult(result);
      setCopiedPrn(false);
      openCardCheckoutWindow(result.paymentSession.paymentUrl);
      trackPayment({
        result,
        customerName: customer.businessName,
        bundleName: bundle.name,
        primaryMsisdn,
      });
    },
  });
  const cardCheckoutWindowRef = useRef<Window | null>(null);
  const copyFeedbackTimer = useRef<number | null>(null);
  const completionNotifiedRef = useRef("");
  const canStartPayment =
    Boolean(bundle.id && primaryMsisdn && provisioningCount > 0) &&
    (!requiresPayingMsisdn || isUgandaPhoneNumber(payingMsisdn));
  const bundleSummary = useMemo(
    () => [
      { label: "Package", value: `${bundle.name} (${bundle.serviceCode})` },
      { label: "Primary MSISDN", value: primaryMsisdn },
      { label: "Quantity", value: `${provisioningCount}` },
      { label: "Total", value: formatUgx(totalAmount) },
    ],
    [
      bundle.name,
      bundle.serviceCode,
      primaryMsisdn,
      provisioningCount,
      totalAmount,
    ],
  );

  useEffect(() => {
    return () => {
      if (copyFeedbackTimer.current) {
        window.clearTimeout(copyFeedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !trackedPayment?.finalized ||
      trackedPayment.event?.status !== "confirmed" ||
      completionNotifiedRef.current === trackedPayment.id
    ) {
      return;
    }

    completionNotifiedRef.current = trackedPayment.id;
    void onPaymentComplete();
  }, [onPaymentComplete, trackedPayment]);

  function resetCheckout() {
    setPaymentResult(null);
    setCopiedPrn(false);
    setAutoRenew(false);
    cardCheckoutWindowRef.current = null;
    setPayingMsisdnState({
      contextKey: payingMsisdnContextKey,
      value: defaultPayingMsisdn,
    });
    purchaseMutation.reset();
  }

  function updatePayingMsisdn(value: string) {
    setPayingMsisdnState({
      contextKey: payingMsisdnContextKey,
      value,
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (!paymentResult || paymentFinalized)) {
      resetCheckout();
    }

    onOpenChange(nextOpen);
  }

  function startPayment() {
    const redirectUrl =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/payment-status`;

    if (paymentMethod === "card") {
      prepareCardCheckoutWindow();
    }

    purchaseMutation.mutate({
      customerId: customer.id,
      primaryMsisdn,
      bundleId: bundle.id,
      provisioningCount,
      paymentMethod,
      payingMsisdn: requiresPayingMsisdn ? payingMsisdn : undefined,
      prnProvider: paymentMethod === "prn" ? prnProvider : undefined,
      autoRenew,
      redirectUrl,
    });
  }

  function prepareCardCheckoutWindow() {
    if (typeof window === "undefined") {
      return;
    }

    const popup = window.open(
      "",
      "mtn-card-checkout",
      "popup=yes,width=520,height=720,left=120,top=80",
    );

    if (!popup) {
      return;
    }

    popup.document.write(
      '<!doctype html><html><head><title>Card checkout</title></head><body style="font-family:system-ui;padding:24px">Starting card checkout...</body></html>',
    );
    popup.document.close();
    cardCheckoutWindowRef.current = popup;
  }

  function openCardCheckoutWindow(paymentUrl?: string) {
    if (!paymentUrl || typeof window === "undefined") {
      return;
    }

    const checkoutWindow = cardCheckoutWindowRef.current;

    if (checkoutWindow && !checkoutWindow.closed) {
      checkoutWindow.location.href = paymentUrl;
      checkoutWindow.focus();
      return;
    }

    cardCheckoutWindowRef.current = window.open(
      paymentUrl,
      "mtn-card-checkout",
      "popup=yes,width=520,height=720,left=120,top=80",
    );
  }

  async function handleCopyPrn(prn: string) {
    await copyToClipboard(prn);
    setCopiedPrn(true);

    if (copyFeedbackTimer.current) {
      window.clearTimeout(copyFeedbackTimer.current);
    }

    copyFeedbackTimer.current = window.setTimeout(() => {
      setCopiedPrn(false);
      copyFeedbackTimer.current = null;
    }, 1800);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl">Checkout</DialogTitle>
              <DialogDescription className="sr-only">
                Review checkout details and complete payment.
              </DialogDescription>
            </div>
            <Badge variant={paymentResult ? "secondary" : "outline"}>
              {paymentResult ? statusLabel(socketEvent?.status) : "Ready"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-secondary/35 p-3">
              <div className="rounded-lg border border-ink bg-ink p-3 text-white shadow-sm">
                <p className="text-sm font-medium text-white/75">Amount due</p>
                <p className="mt-1 text-2xl font-semibold text-primary">
                  {formatUgx(totalAmount)}
                </p>
                <p className="mt-1 text-sm text-white/70">
                  {customer.businessName}
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <ReceiptText />
                  <h3 className="font-semibold">Order summary</h3>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {bundleSummary.map((item) => (
                    <SummaryRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-3">
              <StepHeader step="1" title="Choose payment method" />
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => {
                  setPaymentMethod(value as PaymentMethod);
                  setPaymentResult(null);
                  setCopiedPrn(false);
                  cardCheckoutWindowRef.current = null;
                }}
                className="grid gap-2 sm:grid-cols-2"
                disabled={isListening || purchaseMutation.isPending}
              >
                {checkoutMethods.map((method) => (
                  <label
                    key={method}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background p-2.5 transition-colors hover:bg-secondary/45",
                      paymentMethod === method &&
                        "border-primary bg-primary/10 ring-1 ring-primary/40",
                      (isListening || purchaseMutation.isPending) &&
                        "cursor-not-allowed opacity-70",
                    )}
                  >
                    <RadioGroupItem value={method} className="mt-1" />
                    <span className="flex min-w-0 flex-1 gap-2">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand text-brand-foreground">
                        {methodIcon(method)}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {formatPaymentMethod(method)}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </section>

            <section className="rounded-lg border border-border/70 bg-card p-3">
              <StepHeader step="2" title="Payment details" />

              <div className="mt-3">
                {paymentMethod === "mobile_money" && (
                  <PhoneField
                    label="Paying phone number"
                    value={payingMsisdn}
                    onValueChange={updatePayingMsisdn}
                    disabled={isListening || purchaseMutation.isPending}
                  />
                )}

                {paymentMethod === "prn" && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">PRN payment provider</p>
                    <RadioGroup
                      value={prnProvider}
                      onValueChange={(value) =>
                        setPrnProvider(value as PrnPaymentProvider)
                      }
                      className="grid gap-2 sm:grid-cols-2"
                      disabled={isListening || purchaseMutation.isPending}
                    >
                      {(["bank", "mobile_money"] as const).map((provider) => (
                        <label
                          key={provider}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-background p-2.5 transition-colors hover:bg-secondary/45",
                            prnProvider === provider &&
                              "border-primary bg-primary/10 ring-1 ring-primary/40",
                          )}
                        >
                          <RadioGroupItem value={provider} />
                          {provider === "bank" ? <Landmark /> : <Smartphone />}
                          <span className="font-medium">
                            {providerLabel(provider)}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                    <div className="rounded-md border border-border/70 bg-background p-2.5 text-sm text-muted-foreground">
                      A PRN will be generated for the selected provider. The
                      payer completes payment outside this form using the
                      generated reference.
                    </div>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="rounded-md border border-border/70 bg-background p-2.5 text-sm text-muted-foreground">
                    Card checkout opens in a small secure window.
                  </div>
                )}

                {paymentMethod === "airtime" && (
                  <div className="rounded-md border border-border/70 bg-background p-2.5 text-sm text-muted-foreground">
                    Airtime will be deducted from the selected primary MSISDN
                    wallet.
                  </div>
                )}

                <label className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background p-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      Auto renew package
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Renew on expiry
                    </span>
                  </span>
                  <Switch
                    checked={autoRenew}
                    disabled={isListening || purchaseMutation.isPending}
                    onCheckedChange={setAutoRenew}
                  />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-border/70 bg-card p-3">
              <StepHeader step="3" title="Provider response" />

              <div className="mt-3 flex flex-col gap-2">
                {paymentResult?.paymentSession.prn && (
                  <PrnReference
                    prn={paymentResult.paymentSession.prn}
                    provider={providerLabel(
                      paymentResult.paymentSession.provider ?? "bank",
                    )}
                    copied={copiedPrn}
                    onCopy={() =>
                      handleCopyPrn(paymentResult.paymentSession.prn ?? "")
                    }
                  />
                )}

                {paymentResult?.paymentSession.paymentUrl && (
                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold">
                          <WalletCards />
                          Card checkout ready
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Secure checkout opened in a small window.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          openCardCheckoutWindow(
                            paymentResult.paymentSession.paymentUrl,
                          )
                        }
                      >
                        <ExternalLink />
                        Reopen checkout
                      </Button>
                    </div>
                  </div>
                )}

                {paymentResult?.paymentSession.paymentMethod ===
                  "mobile_money" && (
                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex items-start gap-2">
                      <Smartphone className="mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          Mobile money approval sent
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Approve the prompt on {payingMsisdn}. Confirmation
                          will update here once the provider callback is
                          received.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentResult?.paymentSession.paymentMethod === "airtime" && (
                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex items-start gap-2">
                      <Banknote className="mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          Airtime deduction requested
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          The provider is processing airtime deduction from{" "}
                          {primaryMsisdn}. Confirmation will update here once
                          the callback is received.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentResult || socketError ? (
                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">Payment status</p>
                        <p className="text-sm text-[var(--muted)]">
                          {socketEvent?.message ??
                            (socketError || "Starting payment status updates.")}
                        </p>
                      </div>
                      {socketEvent?.status === "confirmed" ? (
                        <CheckCircle2 className="shrink-0 text-forest" />
                      ) : socketEvent?.status === "failed" ||
                        socketEvent?.status === "expired" ||
                        socketError ? (
                        <XCircle className="shrink-0 text-destructive" />
                      ) : (
                        <Loader2 className="shrink-0 animate-spin text-[var(--muted)]" />
                      )}
                    </div>
                    <Progress value={progressValue} />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-sm text-muted-foreground">
                    Start payment to see provider instructions.
                  </div>
                )}

                {purchaseMutation.isError && (
                  <Alert variant="destructive">
                    <AlertTitle>Payment could not start</AlertTitle>
                    <AlertDescription>
                      {purchaseMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                {socketError && (
                  <Alert variant="destructive">
                    <AlertTitle>Payment update failed</AlertTitle>
                    <AlertDescription>{socketError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-background px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {paymentFinalized ? "Close" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                !canStartPayment ||
                Boolean(paymentResult) ||
                purchaseMutation.isPending
              }
              onClick={startPayment}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {nextActionLabel(paymentMethod, Boolean(paymentResult))}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
