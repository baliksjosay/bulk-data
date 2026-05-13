import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { startAccountActivationOtp } from "@/lib/account-activation";

export const dynamic = "force-dynamic";

const activationOtpSchema = z.object({
  token: z.string().trim().min(8),
});

export async function POST(request: Request) {
  const parsed = activationOtpSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = startAccountActivationOtp(parsed.data.token);

  if (!result) {
    return fail("Activation link is invalid or expired", 400);
  }

  return ok(result, "Activation OTP issued successfully");
}
