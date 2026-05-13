import { fail, ok } from "@/lib/api-response";
import { removeSecondaryNumber } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    customerId: string;
    primaryMsisdn: string;
    secondaryMsisdn: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn, secondaryMsisdn } = await context.params;
  const secondaryNumber = removeSecondaryNumber(customerId, primaryMsisdn, secondaryMsisdn);

  if (!secondaryNumber) {
    return fail("Secondary MSISDN not found", 404);
  }

  return ok(secondaryNumber, "Secondary MSISDN removed successfully");
}
