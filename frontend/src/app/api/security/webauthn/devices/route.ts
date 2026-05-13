import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, webAuthnDevices } from "@/lib/fake-db";
import type { WebAuthnDevice } from "@/types/domain";

export const dynamic = "force-dynamic";

const deviceSchema = z.object({
  label: z.string().min(2),
  credentialId: z.string().min(8),
  transports: z.array(z.enum(["ble", "hybrid", "internal", "nfc", "usb"])).default(["internal"]),
});

export function GET() {
  return ok(webAuthnDevices);
}

export async function POST(request: Request) {
  const parsed = deviceSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const device: WebAuthnDevice = {
    id: `passkey-${Math.random().toString(36).slice(2, 10)}`,
    label: parsed.data.label,
    credentialId: parsed.data.credentialId,
    transports: parsed.data.transports,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    status: "active",
  };

  webAuthnDevices.unshift(device);
  addAuditEvent({
    category: "security",
    action: "WebAuthn device registered",
    actor: "Current user",
    outcome: "success",
  });

  return ok(device, "WebAuthn device registered successfully");
}
