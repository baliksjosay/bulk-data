import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, bundles, customers, paymentSessions, transactions } from "@/lib/fake-db";
import { makePaymentSession } from "@/lib/purchase-session";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { PaymentMethod, PurchaseResult } from "@/types/domain";

export const dynamic = "force-dynamic";

const retrySchema = z.object({
  paymentMethod: z.enum(["mobile_money", "airtime", "prn", "card"]).optional(),
  payingMsisdn: z.string().regex(UGANDA_PHONE_PATTERN).optional(),
  prnProvider: z.enum(["bank", "mobile_money"]).optional(),
  redirectUrl: z.string().url().optional(),
});

interface RouteContext {
  params: Promise<{
    transactionId: string;
  }>;
}

function resolveProvisioningCount(amountUgx: number, bundlePriceUgx: number) {
  if (bundlePriceUgx <= 0) {
    return 1;
  }

  return Math.min(Math.max(Math.round(amountUgx / bundlePriceUgx), 1), 12);
}

export async function POST(request: Request, context: RouteContext) {
  const { transactionId } = await context.params;
  const rawBody = await request.text();
  let payload: unknown = {};

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Validation failed", 422);
  }

  const parsed = retrySchema.safeParse(payload);

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return fail("Transaction not found", 404);
  }

  if (transaction.status !== "failed") {
    return fail("Only failed transactions can be retried", 409);
  }

  const customer = customers.find(
    (item) =>
      item.businessName === transaction.customerName &&
      item.primaryMsisdns.includes(transaction.primaryMsisdn),
  );
  const bundle = bundles.find((item) => item.name === transaction.bundleName);

  if (!customer || !bundle) {
    return fail("Customer or bundle not found", 404);
  }

  if (bundle.status !== "active" || !bundle.visible) {
    return fail("Bundle package is not available for retry", 409);
  }

  const paymentMethod: PaymentMethod = parsed.data.paymentMethod ?? transaction.paymentMethod;
  const provisioningCount = resolveProvisioningCount(transaction.amountUgx, bundle.priceUgx);
  const paymentSession = makePaymentSession({
    amountUgx: transaction.amountUgx,
    bundleId: bundle.id,
    customerId: customer.id,
    paymentMethod,
    prnProvider: parsed.data.prnProvider,
    provisioningCount,
    redirectUrl: parsed.data.redirectUrl,
    transactionId: transaction.id,
    origin: new URL(request.url).origin,
  });

  transaction.status = "pending";
  transaction.paymentMethod = paymentMethod;
  paymentSessions.unshift(paymentSession);

  addAuditEvent({
    category: "bundle",
    action: `Payment retry initiated for ${bundle.serviceCode}`,
    actor: customer.businessName,
    outcome: "success",
  });

  const result: PurchaseResult = {
    transaction,
    paymentSession,
  };

  return ok(result, "Payment retry initiated successfully");
}
