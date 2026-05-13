import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { customers, updateCustomer } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const customerUpdateSchema = z.object({
  businessName: z.string().min(2).optional(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().regex(UGANDA_PHONE_PATTERN).optional(),
  contactPerson: z.string().min(2).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().regex(UGANDA_PHONE_PATTERN).optional(),
  apnName: z.string().min(2).optional(),
  apnId: z.string().min(2).optional(),
});

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return fail("Customer not found", 404);
  }

  return ok(customer);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const parsed = customerUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const customer = updateCustomer(customerId, parsed.data);

  if (!customer) {
    return fail("Customer not found", 404);
  }

  return ok(customer, "Customer updated successfully");
}
