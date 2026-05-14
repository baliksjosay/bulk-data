import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]),
  reason: z.string().trim().max(255).optional(),
});

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const parsed = statusSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const user = staffUsers.find((item) => item.id === userId);

  if (!user) {
    return fail("User not found", 404);
  }

  user.status = parsed.data.status;
  user.isLocked = parsed.data.status === "LOCKED";
  user.updatedAt = new Date().toISOString();

  return ok(user, "User status updated successfully");
}
