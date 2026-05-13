import { z } from "zod";
import { fail, ok, okPaginated } from "@/lib/api-response";
import { addSecondaryNumber, getSecondaryNumbers, secondaryNumbers } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, paginateRows, parseListQuery } from "@/lib/list-query";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { SecondaryNumber } from "@/types/domain";

export const dynamic = "force-dynamic";

const secondaryNumberSchema = z.object({
  msisdn: z.string().regex(UGANDA_PHONE_PATTERN),
});
const secondaryStatuses: SecondaryNumber["status"][] = ["active", "removed"];

type RouteContext = {
  params: Promise<{
    customerId: string;
    primaryMsisdn: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn } = await context.params;
  const url = new URL(request.url);

  if (!url.search) {
    return ok(getSecondaryNumbers(customerId, primaryMsisdn));
  }

  const { page, limit, search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const rows = secondaryNumbers
    .filter((secondaryNumber) => secondaryNumber.customerId === customerId && secondaryNumber.primaryMsisdn === primaryMsisdn)
    .filter((secondaryNumber) => !status || secondaryStatuses.includes(status as SecondaryNumber["status"]) && secondaryNumber.status === status)
    .filter((secondaryNumber) => isWithinDateRange(secondaryNumber.addedAt, dateFrom, dateTo))
    .filter((secondaryNumber) =>
      includesSearch([secondaryNumber.msisdn, secondaryNumber.apnId, secondaryNumber.status], search),
    );
  const result = paginateRows(rows, page, limit);

  return okPaginated(result.data, result.meta);
}

export async function POST(request: Request, context: RouteContext) {
  const { customerId, primaryMsisdn } = await context.params;
  const parsed = secondaryNumberSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = addSecondaryNumber(customerId, primaryMsisdn, parsed.data);

  if (!result) {
    return fail("Customer not found", 404);
  }

  if (!result.validation?.accepted) {
    return fail(result.validation?.reason ?? "Primary MSISDN not found", 422);
  }

  return ok(result, "Secondary MSISDN added successfully");
}
