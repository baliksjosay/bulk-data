import type { PaginationMeta } from "@/types/domain";

export interface ParsedListQuery {
  page: number;
  limit: number;
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export function parseListQuery(searchParams: URLSearchParams): ParsedListQuery {
  return {
    page: parsePositiveInteger(searchParams.get("page"), 1),
    limit: Math.min(parsePositiveInteger(searchParams.get("limit"), 10), 100),
    search: (searchParams.get("search") ?? "").trim().toLowerCase(),
    status: searchParams.get("status") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  };
}

export function paginateRows<T>(rows: T[], page: number, limit: number) {
  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;
  const data = rows.slice(start, start + limit);
  const meta: PaginationMeta = {
    page: safePage,
    limit,
    total,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };

  return { data, meta };
}

export function isWithinDateRange(value: string, dateFrom: string, dateTo: string) {
  const timestamp = new Date(value).getTime();
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00+03:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = dateTo ? new Date(`${dateTo}T23:59:59+03:00`).getTime() : Number.POSITIVE_INFINITY;

  return timestamp >= start && timestamp <= end;
}

export function includesSearch(fields: Array<string | number | undefined>, search: string) {
  if (!search) {
    return true;
  }

  return fields.some((field) => String(field ?? "").toLowerCase().includes(search));
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}
