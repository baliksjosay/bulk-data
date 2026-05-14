import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { completeAccountActivationOtp } from "@/lib/account-activation";

export const dynamic = "force-dynamic";

const activationOtpVerificationSchema = z.object({
  token: z.string().trim().min(8),
  activationId: z.string().trim().min(1),
  otp: z.string().regex(/^\d{5}$/),
});

export async function POST(request: Request) {
  const parsed = activationOtpVerificationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = completeAccountActivationOtp(
    parsed.data.token,
    parsed.data.activationId,
    parsed.data.otp,
  );

  if (!result) {
    return fail("Activation OTP is invalid or expired", 400);
  }

  return ok(result, "Activation OTP verified successfully");
}
