"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ReceiptText, X, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import { formatPaymentMethod, formatUgx } from "@/lib/format";
import { subscribeToPaymentStatus } from "@/lib/payment-socket";
import { cn } from "@/lib/utils";
import { usePaymentStore, type TrackedPayment } from "@/store/payment-store";
import type { PaymentStatusEvent } from "@/types/domain";

const statusProgress: Record<PaymentStatusEvent["status"], number> = {
  awaiting_payment: 35,
  processing: 68,
  confirmed: 100,
  failed: 100,
  expired: 100,
};

function statusLabel(status?: PaymentStatusEvent["status"]) {
  if (!status) {
    return "Starting";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isTerminalStatus(status?: PaymentStatusEvent["status"]) {
  return status === "confirmed" || status === "failed" || status === "expired";
}

async function invalidatePaymentQueries(queryClient: QueryClient, payment: TrackedPayment) {
  const customerId = payment.result.paymentSession.customerId;

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["overview"] }),
    queryClient.invalidateQueries({ queryKey: ["customers"] }),
    queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
    queryClient.invalidateQueries({ queryKey: ["balance", customerId, payment.primaryMsisdn] }),
    queryClient.invalidateQueries({ queryKey: ["admin-report"] }),
    queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["report-transactions-infinite"] }),
    queryClient.invalidateQueries({ queryKey: ["customer-report", customerId] }),
    queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
  ]);
}

function PaymentStatusIcon({ payment }: { payment: TrackedPayment }) {
  const status = payment.event?.status;

  if (status === "confirmed") {
    return <CheckCircle2 className="text-forest" />;
  }

  if (status === "failed" || status === "expired" || payment.errorMessage) {
    return <XCircle className="text-destructive" />;
  }

  if (status === "processing" || status === "awaiting_payment") {
    return <Loader2 className="animate-spin text-primary" />;
  }

  return <ReceiptText className="text-primary" />;
}

function PaymentStatusCard({
  payment,
  onDismiss,
}: {
  payment: TrackedPayment;
  onDismiss: () => void;
}) {
  const status = payment.event?.status;
  const progressValue = status ? statusProgress[status] : 18;
  const message =
    payment.errorMessage ||
    payment.event?.message ||
    "Payment session created. Waiting for provider response.";
  const terminal = isTerminalStatus(status) || Boolean(payment.errorMessage);

  return (
    <Alert
      className={cn(
        "relative border-border/70 bg-popover pr-12 text-popover-foreground shadow-xl",
        terminal && "border-primary/50",
      )}
    >
      <PaymentStatusIcon payment={payment} />
      <AlertTitle className="line-clamp-none pr-1">
        {statusLabel(status)} payment
      </AlertTitle>
      <AlertDescription>
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatPaymentMethod(payment.result.paymentSession.paymentMethod)}</Badge>
            <span className="text-xs text-muted-foreground">{formatUgx(payment.result.paymentSession.amountUgx)}</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{payment.bundleName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {payment.customerName} · {payment.primaryMsisdn}
            </p>
          </div>
          <p>{message}</p>
          <Progress value={progressValue} />
        </div>
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Dismiss payment update"
        className="absolute right-2 top-2"
        onClick={onDismiss}
      >
        <X />
      </Button>
    </Alert>
  );
}

export function PaymentStatusCenter() {
  const queryClient = useQueryClient();
  const payments = usePaymentStore((state) => state.payments);
  const updatePaymentStatus = usePaymentStore((state) => state.updatePaymentStatus);
  const setPaymentError = usePaymentStore((state) => state.setPaymentError);
  const markPaymentFinalized = usePaymentStore((state) => state.markPaymentFinalized);
  const dismissPayment = usePaymentStore((state) => state.dismissPayment);
  const subscriptionsRef = useRef(new Map<string, () => void>());
  const handledTerminalEventsRef = useRef(new Set<string>());

  useEffect(() => {
    const activePaymentIds = new Set(
      payments.filter((payment) => !payment.finalized).map((payment) => payment.id),
    );

    payments.forEach((payment) => {
      if (payment.finalized || subscriptionsRef.current.has(payment.id)) {
        return;
      }

      const unsubscribe = subscribeToPaymentStatus(payment.result.paymentSession, {
        onStatus: (event) => updatePaymentStatus(payment.id, event),
        onError: (message) => setPaymentError(payment.id, message),
      });

      subscriptionsRef.current.set(payment.id, unsubscribe);
    });

    subscriptionsRef.current.forEach((unsubscribe, paymentId) => {
      if (!activePaymentIds.has(paymentId)) {
        unsubscribe();
        subscriptionsRef.current.delete(paymentId);
      }
    });
  }, [payments, setPaymentError, updatePaymentStatus]);

  useEffect(() => {
    const subscriptions = subscriptionsRef.current;

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
    };
  }, []);

  useEffect(() => {
    payments.forEach((payment) => {
      const status = payment.event?.status;

      if (!status || !isTerminalStatus(status) || payment.finalized || handledTerminalEventsRef.current.has(payment.id)) {
        return;
      }

      handledTerminalEventsRef.current.add(payment.id);

      if (status === "expired") {
        markPaymentFinalized(payment.id);
        return;
      }

      void api
        .confirmPurchase(payment.result.transaction.id, {
          sessionId: payment.id,
          status: status === "confirmed" ? "confirmed" : "failed",
        })
        .then(async () => {
          await invalidatePaymentQueries(queryClient, payment);
          markPaymentFinalized(payment.id);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Payment confirmation failed.";

          setPaymentError(payment.id, message);
        });
    });
  }, [markPaymentFinalized, payments, queryClient, setPaymentError]);

  const visiblePayments = payments.filter((payment) => !payment.dismissed).slice(0, 3);

  if (visiblePayments.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {visiblePayments.map((payment) => (
        <PaymentStatusCard
          key={payment.id}
          payment={payment}
          onDismiss={() => dismissPayment(payment.id)}
        />
      ))}
    </div>
  );
}
