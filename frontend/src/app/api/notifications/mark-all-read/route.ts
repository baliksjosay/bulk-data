import { ok } from "@/lib/api-response";
import { markAllInAppNotificationsRead } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export function PATCH() {
  return ok(markAllInAppNotificationsRead(), "Notifications marked as read");
}
