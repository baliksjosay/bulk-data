import { z } from "zod";
import { addAuditEvent } from "@/lib/fake-db";
import type {
  ProvisioningAddGroupMembersBulkRequest,
  ProvisioningAddSubscriberRequest,
  ProvisioningCommandResult,
  ProvisioningDeleteGroupMemberRequest,
  ProvisioningGroupMemberPair,
  ProvisioningOperation,
  ProvisioningUpdateSubscriptionRequest,
} from "@/types/domain";

const PROVISIONING_MSISDN_PATTERN = /^256(77|78|79|76|39)\d{7}$/;

const provisioningMsisdnSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").replace(/^\+/, ""))
  .pipe(z.string().regex(PROVISIONING_MSISDN_PATTERN));

export const provisioningGroupMemberSchema = z.object({
  secondaryMsisdn: provisioningMsisdnSchema,
  primaryMsisdn: provisioningMsisdnSchema,
}) satisfies z.ZodType<ProvisioningGroupMemberPair>;

export const provisioningBulkGroupMembersSchema = z.object({
  groupMembers: z.array(provisioningGroupMemberSchema).min(1).max(500),
}) satisfies z.ZodType<ProvisioningAddGroupMembersBulkRequest>;

export const provisioningDeleteGroupMemberSchema = z.object({
  secondaryMsisdn: provisioningMsisdnSchema,
}) satisfies z.ZodType<ProvisioningDeleteGroupMemberRequest>;

export const provisioningUpdateSubscriptionSchema = z.object({
  primaryMsisdn: provisioningMsisdnSchema,
  serviceCode: z.string().trim().min(1).max(120),
  transactionId: z.string().trim().min(1).max(120),
  topupValue: z.number().int().min(1),
  updateAttemptCount: z.number().int().min(0),
}) satisfies z.ZodType<ProvisioningUpdateSubscriptionRequest>;

export const provisioningAddSubscriberSchema = z.object({
  msisdn: provisioningMsisdnSchema,
  transactionId: z.string().trim().min(1).max(120),
}) satisfies z.ZodType<ProvisioningAddSubscriberRequest>;

export function createProvisioningCommandResult<TRequest>(
  operation: ProvisioningOperation,
  request: TRequest,
): ProvisioningCommandResult<TRequest> {
  const requestId = globalThis.crypto.randomUUID();
  const processedAt = new Date().toISOString();

  const result: ProvisioningCommandResult<TRequest> = {
    requestId,
    operation,
    accepted: true,
    processedAt,
    providerStatusCode: 200,
    request,
    providerResponse: {
      status: "SUCCESS",
      message: "Request accepted",
      referenceId: `PROV-${processedAt.slice(0, 10).replaceAll("-", "")}-${requestId.slice(0, 8).toUpperCase()}`,
    },
  };

  addAuditEvent({
    category: "integration",
    action: provisioningActionLabels[operation],
    actor: "Provisioning operator",
    outcome: "success",
  });

  return result;
}

const provisioningActionLabels: Record<ProvisioningOperation, string> = {
  add_group_member: "Provisioning group member added",
  add_group_members_bulk: "Provisioning bulk group members added",
  delete_group_member: "Provisioning group member deleted",
  update_subscription: "Provisioning subscription updated",
  add_subscriber: "Provisioning subscriber added",
  subscribe_service: "Provisioning service subscribed",
};
