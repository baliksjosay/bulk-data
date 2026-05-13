import { customers } from "@/lib/fake-db";
import type {
  AuthLoginRequest,
  AuthLoginResult,
  AuthRole,
  AuthenticatedUser,
  Customer,
} from "@/types/domain";

const demoStaffUsers: Record<
  Exclude<AuthRole, "customer">,
  AuthenticatedUser
> = {
  admin: {
    id: "usr-admin-001",
    name: "Security Admin",
    email: "admin@mtn.co.ug",
    role: "admin",
  },
  support: {
    id: "usr-support-001",
    name: "Support Operations",
    email: "support@mtn.co.ug",
    role: "support",
  },
};

const demoPasswordsByEmail: Record<string, string> = {
  "baliksjosay@gmail.com": "kimbowa",
};

function makeToken(prefix: string) {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
}

export function customerToAuthenticatedUser(
  customer: Customer,
): AuthenticatedUser {
  return {
    id: `usr-${customer.id}`,
    name: customer.contactPerson,
    email: customer.email,
    role: "customer",
    customerId: customer.id,
  };
}

export function makeLoginResult(
  user: AuthenticatedUser,
  promptPasswordlessSetup: boolean,
): AuthLoginResult {
  return {
    user,
    session: {
      id: makeToken("sess"),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
    nextRoute:
      user.role === "customer"
        ? "/console?section=customer"
        : "/console?section=overview",
    promptPasswordlessSetup,
    passwordlessSetupPrompt: promptPasswordlessSetup
      ? {
          title: "Set up passwordless login",
          message:
            "Add a passkey so your next sign-in can use your device PIN, fingerprint, or face unlock.",
          setupUrl: "/console?section=security",
        }
      : undefined,
  };
}

export function resolveDemoLoginUser(
  payload: AuthLoginRequest,
): AuthenticatedUser {
  if (payload.method === "password") {
    const email =
      (payload.email ?? payload.username ?? payload.phoneNumber)
        ?.trim()
        .toLowerCase() ?? "";

    if (email.includes("admin")) {
      return demoStaffUsers.admin;
    }

    if (email.includes("support")) {
      return demoStaffUsers.support;
    }

    return customerToAuthenticatedUser(
      findCustomerByIdentifier(email) ?? customers[0],
    );
  }

  if (payload.method === "otp") {
    return customerToAuthenticatedUser(
      findCustomerByIdentifier(payload.identifier ?? "") ?? customers[0],
    );
  }

  if (payload.method === "passkey") {
    const credentialId = payload.credentialId?.trim().toLowerCase() ?? "";

    if (credentialId.includes("admin") || credentialId.includes("ops")) {
      return demoStaffUsers.admin;
    }

    if (credentialId.includes("support")) {
      return demoStaffUsers.support;
    }
  }

  return customerToAuthenticatedUser(customers[0]);
}

export function resolveDemoPasswordLoginUser(
  payload: AuthLoginRequest,
): AuthenticatedUser | null {
  const user = resolveDemoLoginUser(payload);
  const email =
    (payload.email ?? payload.username ?? payload.phoneNumber)
      ?.trim()
      .toLowerCase() ?? "";
  const expectedPassword = demoPasswordsByEmail[email];

  if (expectedPassword && payload.password !== expectedPassword) {
    return null;
  }

  return user;
}

export function getCustomerLoginBlockReason(user: AuthenticatedUser) {
  if (user.role !== "customer" || !user.customerId) {
    return null;
  }

  const customer = customers.find((item) => item.id === user.customerId);

  if (!customer) {
    return "Customer account is not registered";
  }

  if (customer.status === "deactivated") {
    return "Customer account is deactivated";
  }

  if (customer.status === "pending") {
    return "Customer account is pending activation";
  }

  return null;
}

function findCustomerByIdentifier(rawIdentifier: string) {
  const identifier = rawIdentifier.trim().toLowerCase();
  const phoneDigits = rawIdentifier.replace(/\D/g, "");

  return customers.find((customer) => {
    const businessPhoneDigits = customer.businessPhone.replace(/\D/g, "");
    const contactPhoneDigits = customer.phone.replace(/\D/g, "");

    return (
      customer.email.toLowerCase() === identifier ||
      customer.businessEmail.toLowerCase() === identifier ||
      customer.registrationNumber.toLowerCase() === identifier ||
      businessPhoneDigits === phoneDigits ||
      contactPhoneDigits === phoneDigits
    );
  });
}
