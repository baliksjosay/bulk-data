import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { convertServiceRequestToCustomer, customers } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const conversionSchema = z.object({
  businessName: z.string().trim().min(2),
  registrationNumber: z.string().trim().min(2),
  businessEmail: z.string().trim().email(),
  businessPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  contactPerson: z.string().trim().min(2),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  apnName: z.string().trim().min(2),
  apnId: z.string().trim().min(2),
  primaryMsisdn: z.string().regex(UGANDA_PHONE_PATTERN),
});

type RouteContext = {
  params: Promise<{
    serviceRequestId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { serviceRequestId } = await context.params;
  const parsed = conversionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  if (customers.some((customer) => customer.registrationNumber === parsed.data.registrationNumber)) {
    return fail("A customer with this registration number already exists", 409);
  }

  const result = convertServiceRequestToCustomer(serviceRequestId, parsed.data);

  if (!result) {
    return fail("Service request not found or already converted", 404);
  }

  if (!result.customer) {
    return fail(result.validation.reason, 422);
  }

  return ok(result, "Service request converted to customer successfully");
}
