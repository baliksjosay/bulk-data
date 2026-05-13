import { ok } from "@/lib/api-response";
import { authSessions } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export function GET() {
  return ok(authSessions);
}
