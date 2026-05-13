import type { PaymentMethod, PaymentSession, PrnPaymentProvider } from "@/types/domain";

export function makePaymentReference(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function makePaymentUrl(redirectUrl: string | undefined, transactionId: string, sessionId: string, origin: string) {
  const baseUrl = redirectUrl ?? `${origin}/payment-status`;
  const url = new URL(baseUrl);

  url.searchParams.set("transactionId", transactionId);
  url.searchParams.set("sessionId", sessionId);

  return url.toString();
}

export function makePaymentSession({
  amountUgx,
  bundleId,
  customerId,
  paymentMethod,
  prnProvider,
  provisioningCount,
  redirectUrl,
  transactionId,
  origin,
}: {
  amountUgx: number;
  bundleId: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  prnProvider?: PrnPaymentProvider;
  provisioningCount: number;
  redirectUrl?: string;
  transactionId: string;
  origin: string;
}): PaymentSession {
  const sessionId = makePaymentReference("pay");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    id: sessionId,
    transactionId,
    paymentMethod,
    status: "awaiting_payment",
    amountUgx,
    currency: "UGX",
    prn: paymentMethod === "prn" ? makePaymentReference("PRN") : undefined,
    provider: paymentMethod === "prn" ? prnProvider ?? "bank" : undefined,
    paymentUrl:
      paymentMethod === "card"
        ? makePaymentUrl(redirectUrl, transactionId, sessionId, origin)
        : undefined,
    socketEvent: "payment.status",
    socketRoom: `payments:${sessionId}`,
    expiresAt,
    createdAt: new Date().toISOString(),
    customerId,
    bundleId,
    provisioningCount,
  };
}
