import { fail, ok } from "@/lib/api-response";
import { staffUsers } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const user = staffUsers.find((item) => item.id === userId);

  if (!user) {
    return fail("User not found", 404);
  }

  user.status = "ACTIVE";
  user.isLocked = false;
  user.updatedAt = new Date().toISOString();

  return ok(user, "User unlocked successfully");
}
