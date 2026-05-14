import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";
import { UGANDA_PHONE_PATTERN } from "@/lib/uganda-phone";

export const dynamic = "force-dynamic";

const userUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phoneNumber: z.string().trim().regex(UGANDA_PHONE_PATTERN).optional(),
  roles: z.array(z.enum(["SUPER_ADMIN", "ADMIN", "CUSTOMER", "SUPPORT"])).optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"])
    .optional(),
});

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const parsed = userUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const user = staffUsers.find((item) => item.id === userId);

  if (!user) {
    return fail("User not found", 404);
  }

  if (
    parsed.data.phoneNumber &&
    staffUsers.some(
      (item) => item.id !== userId && item.phoneNumber === parsed.data.phoneNumber,
    )
  ) {
    return fail("Phone number is already in use", 409);
  }

  Object.assign(user, {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  });

  return ok(user, "User updated successfully");
}
