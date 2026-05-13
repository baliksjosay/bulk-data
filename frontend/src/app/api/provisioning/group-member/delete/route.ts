import { fail, ok } from "@/lib/api-response";
import {
  createProvisioningCommandResult,
  provisioningDeleteGroupMemberSchema,
} from "@/lib/provisioning-command";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = provisioningDeleteGroupMemberSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    createProvisioningCommandResult("delete_group_member", parsed.data),
    "Group member delete request accepted by Provisioning",
  );
}
