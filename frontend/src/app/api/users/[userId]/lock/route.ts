import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const lockSchema = z.object({
  minutes: z.number().int().min(1).max(1440).optional(),
  reason: z.string().trim().max(255).optional(),
});

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const parsed = lockSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const user = staffUsers.find((item) => item.id === userId);

  if (!user) {
    return fail("User not found", 404);
  }

  user.status = "LOCKED";
  user.isLocked = true;
  user.updatedAt = new Date().toISOString();

  return ok(user, "User locked successfully");
}
