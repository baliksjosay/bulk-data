import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { markInAppNotificationsRead } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

export async function PATCH(request: Request) {
  const parsed = markReadSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(markInAppNotificationsRead(parsed.data.notificationIds), "Notifications marked as read");
}
