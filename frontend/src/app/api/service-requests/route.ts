import { z } from "zod";
import { fail, ok, okPaginated } from "@/lib/api-response";
import { createServiceRequest, serviceRequests } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, paginateRows, parseListQuery } from "@/lib/list-query";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const serviceRequestSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactPerson: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  contactPhone: z.string().regex(UGANDA_PHONE_PATTERN),
  preferredPackageId: z.string().trim().optional(),
  message: z.string().trim().max(800).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = parseListQuery(searchParams);
  const rows = serviceRequests
    .filter((serviceRequest) => !query.status || serviceRequest.status === query.status)
    .filter((serviceRequest) => isWithinDateRange(serviceRequest.createdAt, query.dateFrom, query.dateTo))
    .filter((serviceRequest) =>
      includesSearch(
        [
          serviceRequest.businessName,
          serviceRequest.contactPerson,
          serviceRequest.contactEmail,
          serviceRequest.contactPhone,
          serviceRequest.preferredPackageName,
          serviceRequest.status,
        ],
        query.search,
      ),
    );
  const page = paginateRows(rows, query.page, query.limit);

  return okPaginated(page.data, page.meta);
}

export async function POST(request: Request) {
  const parsed = serviceRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(createServiceRequest(parsed.data), "Service request submitted successfully");
}
