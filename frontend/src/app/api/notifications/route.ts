import { ok } from "@/lib/api-response";
import { inAppNotifications } from "@/lib/fake-db";
import { paginateRows, parseListQuery } from "@/lib/list-query";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit } = parseListQuery(url.searchParams);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const rows = inAppNotifications
    .filter((notification) => !unreadOnly || !notification.isRead)
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const result = paginateRows(rows, page, limit);

  return ok({ data: result.data, total: result.meta.total });
}
