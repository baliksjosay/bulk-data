import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { setAuthSessionCookie } from "@/lib/auth-session-cookie";
import {
  getCustomerLoginBlockReason,
  makeLoginResult,
  resolveDemoLoginUser,
  resolveDemoPasswordLoginUser,
} from "@/lib/demo-auth";
import { addAuditEvent } from "@/lib/fake-db";
import type { AuthLoginResult } from "@/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  method: z.enum(["otp", "password", "passkey"]),
  identifier: z.string().optional(),
  identifierKind: z.enum(["phone", "email", "tin"]).optional(),
  otp: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().optional(),
  credentialId: z.string().optional(),
});

function okWithSessionCookie(result: AuthLoginResult) {
  try {
    const response = ok(result, "Signed in successfully");
    setAuthSessionCookie(response, result);
    return response;
  } catch {
    return fail("Session configuration is unavailable", 500);
  }
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return fail("Validation failed", 422);
  }

  const payload = parsed.data;

  if (payload.method === "password") {
    if (
      (!payload.email && !payload.username && !payload.phoneNumber) ||
      !payload.password
    ) {
      return fail(
        "Username, email, or phone number and password are required",
        422,
      );
    }

    const user = resolveDemoPasswordLoginUser(payload);

    if (!user) {
      return fail("Invalid email or password", 401);
    }

    const blockReason = getCustomerLoginBlockReason(user);

    if (blockReason) {
      return fail(blockReason, 401);
    }

    const result = makeLoginResult(user, true);
    addAuditEvent({
      category: "security",
      action: "Email password login",
      actor: result.user.email,
      outcome: "success",
    });

    return okWithSessionCookie(result);
  }

  if (payload.method === "otp") {
    if (!payload.identifier || !payload.otp) {
      return fail("Identifier and OTP code are required", 422);
    }

    const user = resolveDemoLoginUser(payload);
    const blockReason = getCustomerLoginBlockReason(user);

    if (blockReason) {
      return fail(blockReason, 401);
    }

    const result = makeLoginResult(user, true);
    addAuditEvent({
      category: "security",
      action: "OTP login",
      actor: payload.identifier,
      outcome: "success",
    });

    return okWithSessionCookie(result);
  }

  if (!payload.credentialId) {
    return fail("Passkey credential is required", 422);
  }

  const user = resolveDemoLoginUser(payload);
  const blockReason = getCustomerLoginBlockReason(user);

  if (blockReason) {
    return fail(blockReason, 401);
  }

  const result = makeLoginResult(user, false);
  addAuditEvent({
    category: "security",
    action: "Passkey login",
    actor: result.user.email,
    outcome: "success",
  });

  return okWithSessionCookie(result);
}
