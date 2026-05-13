import { ok } from "@/lib/api-response";
import { totpAuthenticatorApps } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export function GET() {
  return ok(totpAuthenticatorApps, "Authenticator apps fetched successfully");
}
