import { ok, okPaginated } from "@/lib/api-response";
import { auditEvents } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, paginateRows, parseListQuery } from "@/lib/list-query";
import type { AuditEvent } from "@/types/domain";

export const dynamic = "force-dynamic";

const auditOutcomes: AuditEvent["outcome"][] = ["success", "warning", "failed"];

export function GET(request: Request) {
  const url = new URL(request.url);

  if (!url.search) {
    return ok(auditEvents);
  }

  const { page, limit, search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const category = url.searchParams.get("category") ?? "";
  const rows = auditEvents
    .filter((event) => !category || event.category === category)
    .filter((event) => !status || auditOutcomes.includes(status as AuditEvent["outcome"]) && event.outcome === status)
    .filter((event) => isWithinDateRange(event.createdAt, dateFrom, dateTo))
    .filter((event) => includesSearch([event.category, event.action, event.actor, event.outcome], search));
  const result = paginateRows(rows, page, limit);

  return okPaginated(result.data, result.meta);
}
