import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { startAccountActivationOtpForDestination } from "@/lib/account-activation";

export const dynamic = "force-dynamic";

const activationOtpSchema = z.object({
  token: z.string().trim().min(8),
  identifier: z.string().trim().min(3),
  deliveryChannel: z.enum(["email", "sms"]),
});

export async function POST(request: Request) {
  const parsed = activationOtpSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = startAccountActivationOtpForDestination(
    parsed.data.token,
    parsed.data.identifier,
    parsed.data.deliveryChannel,
  );

  if (!result) {
    return fail("Activation link is invalid or expired", 400);
  }

  return ok(result, "Activation OTP issued successfully");
}
