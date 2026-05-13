import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { completeAccountActivationPassword } from "@/lib/account-activation";
import { setAuthSessionCookie } from "@/lib/auth-session-cookie";

export const dynamic = "force-dynamic";

const activationPasswordSchema = z
  .object({
    passwordSetupToken: z.string().trim().min(8),
    password: z
      .string()
      .min(12)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/\d/),
    confirmPassword: z.string().min(1),
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  const parsed = activationPasswordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = completeAccountActivationPassword(parsed.data.passwordSetupToken);

  if (!result) {
    return fail("Password setup token is invalid or expired", 400);
  }

  const response = ok(result, "Account activated successfully");
  setAuthSessionCookie(response, result);

  return response;
}
