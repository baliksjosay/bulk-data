import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { convertServiceRequestToCustomer, customers } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const conversionSchema = z.object({
  businessName: z.string().trim().min(2),
  registrationNumber: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(2).optional(),
  ),
  tin: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(40).optional(),
  ),
  businessEmail: z.string().trim().email(),
  businessPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  contactPerson: z.string().trim().min(2),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  apnName: z.string().trim().min(2),
  apnId: z.string().trim().min(2),
  primaryMsisdn: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().regex(UGANDA_PHONE_PATTERN).optional(),
  ),
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

  if (
    parsed.data.registrationNumber &&
    customers.some(
      (customer) =>
        customer.registrationNumber === parsed.data.registrationNumber,
    )
  ) {
    return fail("A customer with this registration number already exists", 409);
  }

  if (
    parsed.data.tin &&
    customers.some((customer) => customer.tin === parsed.data.tin)
  ) {
    return fail("A customer with this TIN already exists", 409);
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
