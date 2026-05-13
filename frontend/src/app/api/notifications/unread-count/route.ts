import { ok } from "@/lib/api-response";
import { inAppNotifications } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({
    count: inAppNotifications.filter((notification) => !notification.isRead).length,
  });
}
