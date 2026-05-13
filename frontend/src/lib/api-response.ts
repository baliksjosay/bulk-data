import { NextResponse } from "next/server";
import type { ApiEnvelope, PaginationMeta } from "@/types/domain";

export function ok<T>(data: T, message = "Records fetched successfully") {
  return NextResponse.json<ApiEnvelope<T>>({
    success: true,
    message,
    data,
  });
}

export function okPaginated<T>(data: T[], meta: PaginationMeta, message = "Records fetched successfully") {
  return NextResponse.json<ApiEnvelope<T[]>>({
    success: true,
    message,
    data,
    meta,
  });
}

export function fail(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
      data: null,
    },
    { status },
  );
}
