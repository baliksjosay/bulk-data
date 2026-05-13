import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";
import type { StaffUserCreateRequest, UserAccount } from "@/types/domain";

export const dynamic = "force-dynamic";

const staffUserSchema = z.object({
  phoneNumber: z.string().regex(UGANDA_PHONE_PATTERN),
  email: z.string().email(),
  lanId: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._-]+$/),
  role: z.enum(["ADMIN", "SUPPORT"]),
});

const createdStaffUsers: UserAccount[] = [];

export async function POST(request: Request) {
  const parsed = staffUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const payload: StaffUserCreateRequest = parsed.data;
  const existing = createdStaffUsers.find(
    (user) =>
      user.email.toLowerCase() === payload.email.toLowerCase() ||
      user.phoneNumber === payload.phoneNumber ||
      user.externalId?.toLowerCase() === payload.lanId.toLowerCase(),
  );

  if (existing) {
    return fail(
      "Email address, phone number, or login identifier already exists",
      409,
    );
  }

  const now = new Date().toISOString();
  const localPart = payload.email.split("@")[0] || payload.lanId;
  const [firstName, ...lastNameParts] = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  const user: UserAccount = {
    id: `user-${randomUUID()}`,
    firstName: firstName || payload.lanId,
    lastName: lastNameParts.join(" ") || null,
    email: payload.email.toLowerCase(),
    phoneNumber: payload.phoneNumber,
    authProvider: "ACTIVE_DIRECTORY",
    externalId: payload.lanId.toLowerCase(),
    roles: [payload.role],
    status: "ACTIVE",
    emailVerified: true,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  createdStaffUsers.unshift(user);

  return ok(user, "Staff user created successfully");
}
