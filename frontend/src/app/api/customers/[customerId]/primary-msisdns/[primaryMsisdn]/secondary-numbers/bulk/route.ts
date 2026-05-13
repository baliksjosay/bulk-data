import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addBulkSecondaryNumbers } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const bulkSecondarySchema = z.object({
  msisdns: z.array(z.string().regex(UGANDA_PHONE_PATTERN)).min(1).max(500),
});

type RouteContext = {
  params: Promise<{
    customerId: string;
    primaryMsisdn: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn } = await context.params;
  const parsed = bulkSecondarySchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = addBulkSecondaryNumbers(customerId, primaryMsisdn, parsed.data);

  if (!result) {
    return fail("Customer or primary MSISDN not found", 404);
  }

  return ok(result, "Bulk secondary MSISDN upload processed");
}
