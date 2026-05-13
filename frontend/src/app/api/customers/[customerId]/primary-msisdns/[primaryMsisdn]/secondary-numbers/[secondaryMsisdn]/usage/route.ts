import { fail, ok } from "@/lib/api-response";
import { getSecondaryNumberUsage } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    customerId: string;
    primaryMsisdn: string;
    secondaryMsisdn: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn, secondaryMsisdn } = await context.params;
  const usage = getSecondaryNumberUsage(customerId, primaryMsisdn, secondaryMsisdn);

  if (!usage) {
    return fail("Secondary MSISDN usage not found", 404);
  }

  return ok(usage, "Secondary MSISDN usage fetched successfully");
}
