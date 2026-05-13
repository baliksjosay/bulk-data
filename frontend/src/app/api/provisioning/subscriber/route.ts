import { fail, ok } from "@/lib/api-response";
import {
  createProvisioningCommandResult,
  provisioningAddSubscriberSchema,
} from "@/lib/provisioning-command";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = provisioningAddSubscriberSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    createProvisioningCommandResult("add_subscriber", parsed.data),
    "Subscriber request accepted by Provisioning",
  );
}
