import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { changeCustomerStatus } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.enum(["active", "deactivated"]),
  reason: z.string().min(3),
  supportingNote: z.string().optional(),
});

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const parsed = statusSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const customer = changeCustomerStatus(customerId, parsed.data);

  if (!customer) {
    return fail("Customer not found", 404);
  }

  return ok(customer, "Customer status updated successfully");
}
