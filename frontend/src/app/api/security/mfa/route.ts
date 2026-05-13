import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, mfaConfiguration, setMfaConfiguration } from "@/lib/fake-db";
import type { MfaConfiguration } from "@/types/domain";

export const dynamic = "force-dynamic";

const mfaConfigurationSchema = z.object({
  services: z.array(
    z.object({
      id: z.enum(["totp", "email_otp", "sms_otp", "webauthn", "recovery_codes"]),
      label: z.string().min(1),
      enabled: z.boolean(),
      requiredForAdmins: z.boolean(),
      requiredForCustomers: z.boolean(),
      lastUpdatedAt: z.string(),
    }),
  ),
  trustedDeviceDays: z.number().int().min(0).max(90),
  stepUpForBundlePurchases: z.boolean(),
  stepUpForSecondaryNumberChanges: z.boolean(),
});

export function GET() {
  return ok(mfaConfiguration);
}

export async function PUT(request: Request) {
  const parsed = mfaConfigurationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const nextConfiguration: MfaConfiguration = {
    ...parsed.data,
    services: parsed.data.services.map((service) => ({
      ...service,
      lastUpdatedAt: new Date().toISOString(),
    })),
  };

  setMfaConfiguration(nextConfiguration);
  addAuditEvent({
    category: "security",
    action: "MFA services configuration updated",
    actor: "Security administrator",
    outcome: "success",
  });

  return ok(nextConfiguration, "MFA configuration updated successfully");
}
