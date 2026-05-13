import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addPrimaryMsisdn } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const primaryMsisdnSchema = z.object({
  primaryMsisdn: z.string().regex(UGANDA_PHONE_PATTERN),
});

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const parsed = primaryMsisdnSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = addPrimaryMsisdn(customerId, parsed.data);

  if (!result) {
    return fail("Customer not found", 404);
  }

  if (!result.validation.accepted) {
    return fail(result.validation.reason, 422);
  }

  return ok(result, "Primary MSISDN added successfully");
}
