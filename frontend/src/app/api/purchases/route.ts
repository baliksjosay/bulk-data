import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, bundles, customers, paymentSessions, transactions } from "@/lib/fake-db";
import { makePaymentReference, makePaymentSession } from "@/lib/purchase-session";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { PurchaseResult } from "@/types/domain";

export const dynamic = "force-dynamic";

const purchaseSchema = z.object({
  customerId: z.string().min(1),
  primaryMsisdn: z.string().regex(UGANDA_PHONE_PATTERN),
  bundleId: z.string().min(1),
  provisioningCount: z.number().int().min(1).max(12),
  paymentMethod: z.enum(["mobile_money", "airtime", "prn", "card"]),
  payingMsisdn: z.string().regex(UGANDA_PHONE_PATTERN).optional(),
  prnProvider: z.enum(["bank", "mobile_money"]).optional(),
  autoRenew: z.boolean().optional(),
  redirectUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const parsed = purchaseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const customer = customers.find((item) => item.id === parsed.data.customerId);
  const bundle = bundles.find((item) => item.id === parsed.data.bundleId);

  if (!customer || !bundle) {
    return fail("Customer or bundle not found", 404);
  }

  if (bundle.status !== "active" || !bundle.visible) {
    return fail("Bundle package is not available for purchase", 409);
  }

  if (customer.status !== "active") {
    return fail("Customer account is not active", 403);
  }

  if (!customer.primaryMsisdns.includes(parsed.data.primaryMsisdn)) {
    return fail("Primary MSISDN is not registered to this customer", 409);
  }

  if (parsed.data.paymentMethod === "prn" && !parsed.data.prnProvider) {
    return fail("PRN payment provider is required", 422);
  }

  const amountUgx = bundle.priceUgx * parsed.data.provisioningCount;
  const transactionId = makePaymentReference("txn").toLowerCase();
  const transaction = {
    id: transactionId,
    customerName: customer.businessName,
    primaryMsisdn: parsed.data.primaryMsisdn,
    bundleName: bundle.name,
    paymentMethod: parsed.data.paymentMethod,
    amountUgx,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  const paymentSession = makePaymentSession({
    amountUgx,
    bundleId: bundle.id,
    customerId: customer.id,
    paymentMethod: parsed.data.paymentMethod,
    prnProvider: parsed.data.prnProvider,
    provisioningCount: parsed.data.provisioningCount,
    redirectUrl: parsed.data.redirectUrl,
    transactionId,
    origin: new URL(request.url).origin,
  });

  transactions.unshift(transaction);
  paymentSessions.unshift(paymentSession);

  addAuditEvent({
    category: "bundle",
    action: `Payment initiated for ${bundle.serviceCode}`,
    actor: customer.businessName,
    outcome: "success",
  });

  const result: PurchaseResult = {
    transaction,
    paymentSession,
  };

  return ok(result, "Payment initiated successfully");
}
