import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import type { PasswordPolicy } from "@/types/domain";

export const dynamic = "force-dynamic";

let passwordPolicy: PasswordPolicy = {
  appliesTo: "CUSTOMER_LOCAL",
  maxPasswordAgeWarmBodiedDays: 90,
  maxPasswordAgeServiceAccountDays: 365,
  minPasswordAgeDays: 1,
  passwordHistoryCount: 24,
  minPasswordLength: 14,
  complexityEnabled: true,
  hashingEnabled: true,
  accountLockoutThreshold: 3,
  maxSessionsPerUser: 1,
  forcePasswordChangeAtFirstLogin: true,
  inactiveAccountLockDays: 90,
  ssoAllowed: true,
  mfaSupported: true,
  leastPrivilegeEnabled: true,
  rbacEnabled: true,
  pamProvider: "BeyondTrust",
};

const passwordPolicySchema = z.object({
  maxPasswordAgeWarmBodiedDays: z.number().int().min(1).max(730).optional(),
  maxPasswordAgeServiceAccountDays: z.number().int().min(1).max(1095).optional(),
  minPasswordAgeDays: z.number().int().min(0).max(30).optional(),
  passwordHistoryCount: z.number().int().min(0).max(50).optional(),
  minPasswordLength: z.number().int().min(8).max(128).optional(),
  complexityEnabled: z.boolean().optional(),
  hashingEnabled: z.boolean().optional(),
  accountLockoutThreshold: z.number().int().min(1).max(20).optional(),
  maxSessionsPerUser: z.number().int().min(1).max(20).optional(),
  forcePasswordChangeAtFirstLogin: z.boolean().optional(),
  inactiveAccountLockDays: z.number().int().min(1).max(730).optional(),
  ssoAllowed: z.boolean().optional(),
  mfaSupported: z.boolean().optional(),
  leastPrivilegeEnabled: z.boolean().optional(),
  rbacEnabled: z.boolean().optional(),
  pamProvider: z.string().trim().min(1).optional(),
});

export async function GET() {
  return ok(passwordPolicy, "Password policy fetched successfully");
}

export async function PATCH(request: Request) {
  const parsed = passwordPolicySchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  passwordPolicy = {
    ...passwordPolicy,
    ...parsed.data,
    appliesTo: "CUSTOMER_LOCAL",
    updatedAt: new Date().toISOString(),
  };

  return ok(passwordPolicy, "Password policy updated successfully");
}
