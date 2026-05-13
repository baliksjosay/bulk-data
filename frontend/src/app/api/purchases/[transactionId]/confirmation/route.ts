import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, bundles, customers, paymentSessions, transactions } from "@/lib/fake-db";
import type { PurchaseConfirmationResult } from "@/types/domain";

export const dynamic = "force-dynamic";

const confirmationSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["confirmed", "failed"]),
});

interface RouteContext {
  params: Promise<{
    transactionId: string;
  }>;
}

function buildProvisioningRequest(provisioningCount: number, confirmed: boolean) {
  return {
    subscribeService: confirmed,
    modifySubSubscription: confirmed && provisioningCount > 1,
    srvTopupCount: confirmed ? Math.max(provisioningCount - 1, 0) : 0,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { transactionId } = await context.params;
  const parsed = confirmationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const transaction = transactions.find((item) => item.id === transactionId);
  const paymentSession = paymentSessions.find(
    (item) => item.id === parsed.data.sessionId && item.transactionId === transactionId,
  );

  if (!transaction || !paymentSession) {
    return fail("Payment session not found", 404);
  }

  if (paymentSession.status === "confirmed" && transaction.status === "provisioned") {
    const result: PurchaseConfirmationResult = {
      transaction,
      paymentSession,
      provisioningRequest: buildProvisioningRequest(paymentSession.provisioningCount, true),
    };

    return ok(result, "Payment already confirmed");
  }

  const customer = customers.find((item) => item.id === paymentSession.customerId);
  const bundle = bundles.find((item) => item.id === paymentSession.bundleId);

  if (!customer || !bundle) {
    return fail("Customer or bundle not found", 404);
  }

  if (parsed.data.status === "failed") {
    transaction.status = "failed";
    paymentSession.status = "failed";
    addAuditEvent({
      category: "bundle",
      action: `Payment failed for ${bundle.serviceCode}`,
      actor: customer.businessName,
      outcome: "warning",
    });

    const result: PurchaseConfirmationResult = {
      transaction,
      paymentSession,
      provisioningRequest: buildProvisioningRequest(paymentSession.provisioningCount, false),
    };

    return ok(result, "Payment marked as failed");
  }

  transaction.status = "provisioned";
  paymentSession.status = "confirmed";
  customer.bundlePurchases += paymentSession.provisioningCount;
  customer.totalSpendUgx += paymentSession.amountUgx;

  addAuditEvent({
    category: "bundle",
    action: `Provisioned ${bundle.serviceCode}`,
    actor: customer.businessName,
    outcome: "success",
  });

  const result: PurchaseConfirmationResult = {
    transaction,
    paymentSession,
    provisioningRequest: buildProvisioningRequest(paymentSession.provisioningCount, true),
  };

  return ok(result, "Payment confirmed and bundle provisioned successfully");
}
