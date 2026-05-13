import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, preferences, setPreferences } from "@/lib/fake-db";
import type { UserPreferences } from "@/types/domain";

export const dynamic = "force-dynamic";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  language: z.enum(["en", "lug"]),
  timezone: z.string().min(1),
  defaultLanding: z.enum(["overview", "admin", "customer", "security"]),
  dataDensity: z.enum(["comfortable", "compact"]),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    whatsapp: z.boolean(),
    inApp: z.boolean(),
  }),
});

export function GET() {
  return ok(preferences);
}

export async function PUT(request: Request) {
  const parsed = preferencesSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  setPreferences(parsed.data satisfies UserPreferences);
  addAuditEvent({
    category: "security",
    action: "User preferences updated",
    actor: "Current user",
    outcome: "success",
  });

  return ok(parsed.data, "Preferences updated successfully");
}
