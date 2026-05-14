import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const rolesSchema = z.object({
  roles: z.array(z.enum(["SUPER_ADMIN", "ADMIN", "CUSTOMER", "SUPPORT"])).min(1),
});

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const parsed = rolesSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const user = staffUsers.find((item) => item.id === userId);

  if (!user) {
    return fail("User not found", 404);
  }

  user.roles = [...new Set(parsed.data.roles)];
  user.updatedAt = new Date().toISOString();

  return ok(user, "User roles updated successfully");
}
