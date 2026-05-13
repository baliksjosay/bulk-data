import { fail, ok } from "@/lib/api-response";
import {
  createProvisioningCommandResult,
  provisioningUpdateSubscriptionSchema,
} from "@/lib/provisioning-command";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = provisioningUpdateSubscriptionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    createProvisioningCommandResult("update_subscription", parsed.data),
    "Subscription update request accepted by Provisioning",
  );
}
