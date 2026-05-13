import { fail, ok } from "@/lib/api-response";
import { authSessions, revokeAuthSession } from "@/lib/fake-db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = authSessions.find((item) => item.id === sessionId);

  if (!session) {
    return fail("Session not found", 404);
  }

  if (session.current) {
    return fail("Current session cannot be revoked from this endpoint", 409);
  }

  const revokedSession = revokeAuthSession(sessionId);

  if (!revokedSession) {
    return fail("Session could not be revoked", 400);
  }

  return ok(revokedSession, "Session revoked successfully");
}
