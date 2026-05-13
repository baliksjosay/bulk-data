import { z } from "zod";
import { fail, ok, okPaginated } from "@/lib/api-response";
import { customers, registerCustomer } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, paginateRows, parseListQuery } from "@/lib/list-query";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { CustomerStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const customerRegistrationSchema = z.object({
  businessName: z.string().min(2),
  registrationNumber: z.string().min(2),
  businessEmail: z.string().email(),
  businessPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  contactPerson: z.string().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  apnName: z.string().min(2),
  apnId: z.string().min(2),
  primaryMsisdn: z.string().regex(UGANDA_PHONE_PATTERN),
});

const customerStatuses: CustomerStatus[] = ["active", "deactivated", "pending"];

export function GET(request: Request) {
  const url = new URL(request.url);

  if (!url.search) {
    return ok(customers);
  }

  const { page, limit, search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const rows = customers
    .filter((customer) => !status || customerStatuses.includes(status as CustomerStatus) && customer.status === status)
    .filter((customer) => isWithinDateRange(customer.createdAt, dateFrom, dateTo))
    .filter((customer) =>
      includesSearch(
        [
          customer.businessName,
          customer.registrationNumber,
          customer.businessEmail,
          customer.businessPhone,
          customer.contactPerson,
          customer.email,
          customer.phone,
          customer.apnName,
          customer.apnId,
          customer.primaryMsisdns.join(" "),
        ],
        search,
      ),
    );
  const result = paginateRows(rows, page, limit);

  return okPaginated(result.data, result.meta);
}

export async function POST(request: Request) {
  const parsed = customerRegistrationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  if (customers.some((customer) => customer.registrationNumber === parsed.data.registrationNumber)) {
    return fail("A customer with this registration number already exists", 409);
  }

  const result = registerCustomer(parsed.data);

  if (!result.customer) {
    return fail(result.validation.reason, 422);
  }

  return ok(result, "Customer registered successfully");
}
