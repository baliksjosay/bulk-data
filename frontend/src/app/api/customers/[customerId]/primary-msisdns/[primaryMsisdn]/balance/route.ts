import { fail, ok } from "@/lib/api-response";
import { customers, getCustomerBalance } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    customerId: string;
    primaryMsisdn: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn } = await context.params;
  const customer = customers.find((item) => item.id === customerId);

  if (!customer || !customer.primaryMsisdns.includes(primaryMsisdn)) {
    return fail("Customer or primary MSISDN not found", 404);
  }

  return ok(getCustomerBalance(primaryMsisdn));
}
