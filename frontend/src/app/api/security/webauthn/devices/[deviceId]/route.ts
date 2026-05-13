import { fail, ok } from "@/lib/api-response";
import { addAuditEvent, webAuthnDevices } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await context.params;
  const device = webAuthnDevices.find((item) => item.id === deviceId);

  if (!device) {
    return fail("WebAuthn device not found", 404);
  }

  device.status = "revoked";
  addAuditEvent({
    category: "security",
    action: "WebAuthn device revoked",
    actor: "Current user",
    outcome: "success",
  });

  return ok(device, "WebAuthn device revoked successfully");
}
