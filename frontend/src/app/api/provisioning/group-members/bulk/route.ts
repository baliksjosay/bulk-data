import { fail, ok } from "@/lib/api-response";
import {
  createProvisioningCommandResult,
  provisioningBulkGroupMembersSchema,
} from "@/lib/provisioning-command";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = provisioningBulkGroupMembersSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    createProvisioningCommandResult("add_group_members_bulk", parsed.data),
    "Bulk group-member request accepted by Provisioning",
  );
}
