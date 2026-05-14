import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok, okPaginated } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";
import { includesSearch, paginateRows, parseListQuery } from "@/lib/list-query";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { StaffUserCreateRequest, UserAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

const optionalTrimmedString = (schema: z.ZodString) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }, schema.optional());

const staffUserSchema = z.object({
  email: z.string().trim().email(),
  phoneNumber: optionalTrimmedString(z.string().regex(UGANDA_PHONE_PATTERN)),
  lanId: optionalTrimmedString(
    z.string().max(255).regex(/^[A-Za-z0-9._-]+$/),
  ),
  role: z.enum(["ADMIN", "SUPPORT"]).optional().default("SUPPORT"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = parseListQuery(searchParams);
  const role = searchParams.get("role");
  const rows = staffUsers
    .filter((user) =>
      role === "ADMIN" || role === "SUPPORT" ? user.roles.includes(role) : true,
    )
    .filter((user) =>
      query.status ? user.status === query.status.toUpperCase() : true,
    )
    .filter((user) =>
      includesSearch(
        [
          user.firstName,
          user.lastName ?? undefined,
          user.email,
          user.phoneNumber,
          user.externalId,
          user.status,
          user.roles.join(" "),
        ],
        query.search,
      ),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  const page = paginateRows(rows, query.page, query.limit);

  return okPaginated(page.data, page.meta, "Staff users fetched successfully");
}

export async function POST(request: Request) {
  const parsed = staffUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const payload: StaffUserCreateRequest = parsed.data;
  const existing = staffUsers.find(
    (user) =>
      user.email.toLowerCase() === payload.email.toLowerCase() ||
      (payload.phoneNumber && user.phoneNumber === payload.phoneNumber) ||
      (payload.lanId &&
        user.externalId?.toLowerCase() === payload.lanId.toLowerCase()),
  );

  if (existing) {
    return fail(
      "Email address, phone number, or login identifier already exists",
      409,
    );
  }

  const now = new Date().toISOString();
  const localPart = payload.email.split("@")[0] || payload.lanId || "staff";
  const [firstName, ...lastNameParts] = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  const user: UserAccount = {
    id: `user-${randomUUID()}`,
    firstName: firstName || "Staff",
    lastName: lastNameParts.join(" ") || null,
    email: payload.email.toLowerCase(),
    ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
    authProvider: "ACTIVE_DIRECTORY",
    ...(payload.lanId ? { externalId: payload.lanId.toLowerCase() } : {}),
    roles: [payload.role ?? "SUPPORT"],
    status: "ACTIVE",
    emailVerified: true,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  staffUsers.unshift(user);

  return ok(user, "Staff user created successfully");
}
