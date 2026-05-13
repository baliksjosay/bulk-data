import { randomBytes } from "node:crypto";
import { ok } from "@/lib/api-response";
import type { WebAuthnRegistrationOptions } from "@/types/domain";

export const dynamic = "force-dynamic";

function base64Url(bytes: Buffer) {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function POST() {
  const options: WebAuthnRegistrationOptions = {
    challenge: base64Url(randomBytes(32)),
    rp: {
      id: "localhost",
      name: "MTN Bulk Data Wholesale",
    },
    user: {
      id: base64Url(randomBytes(16)),
      name: "security.admin@mtn.ug",
      displayName: "Security Administrator",
    },
    pubKeyCredParams: [
      {
        type: "public-key",
        alg: -7,
      },
      {
        type: "public-key",
        alg: -257,
      },
    ],
    timeout: 60_000,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    attestation: "none",
  };

  return ok(options, "WebAuthn registration options generated");
}
