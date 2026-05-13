import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { startTotpEnrollment } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

const enrollmentSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const parsed = enrollmentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  return ok(
    await startTotpEnrollment(parsed.data.label),
    "Authenticator app enrollment started",
  );
}
