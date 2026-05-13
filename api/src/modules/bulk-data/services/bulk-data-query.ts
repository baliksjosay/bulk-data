import { ListQueryDto } from '../dto/bulk-data.dto';
import { PaginationMeta } from './bulk-data.types';

export function ok<T>(data: T, message: string) {
  return {
    success: true as const,
    message,
    data,
  };
}

export function okPaginated<T>(
  data: T[],
  meta: PaginationMeta,
  message: string,
) {
  return {
    success: true as const,
    message,
    data,
    meta,
  };
}

export function paginate<T>(rows: T[], query: ListQueryDto) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  const total = rows.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const offset = (page - 1) * limit;
  const data = rows.slice(offset, offset + limit);
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
  return { data, meta };
}

export function matchesSearch(
  values: Array<string | number | undefined>,
  search?: string,
) {
  if (!search) {
    return true;
  }

  const normalized = search.toLowerCase();
  return values.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(normalized),
  );
}

export function withinDateRange(
  date: Date,
  query: { dateFrom?: string; dateTo?: string },
) {
  const timestamp = date.getTime();

  if (query.dateFrom && timestamp < new Date(query.dateFrom).getTime()) {
    return false;
  }

  if (query.dateTo) {
    const end = new Date(query.dateTo);
    end.setHours(23, 59, 59, 999);

    if (timestamp > end.getTime()) {
      return false;
    }
  }

  return true;
}

export function slugId(prefix: string, value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  return `${prefix}-${slug || Date.now().toString(36)}`;
}

export function sequenceId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
