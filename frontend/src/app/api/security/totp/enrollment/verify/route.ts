import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { verifyTotpEnrollment } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const verificationSchema = z.object({
  enrollmentId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const parsed = verificationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const result = verifyTotpEnrollment(parsed.data.enrollmentId, parsed.data.code);

  if (!result) {
    return fail("Authenticator code is invalid or enrollment has expired", 400);
  }

  return ok(result, "Authenticator app enrolled successfully");
}
