import { fail, ok } from "@/lib/api-response";
import {
  createProvisioningCommandResult,
  provisioningGroupMemberSchema,
} from "@/lib/provisioning-command";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = provisioningGroupMemberSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    createProvisioningCommandResult("add_group_member", parsed.data),
    "Group member request accepted by Provisioning",
  );
}
