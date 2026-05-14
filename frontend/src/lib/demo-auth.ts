import { customers, staffUsers } from "@/lib/fake-db";
import type {
  AuthLoginRequest,
  AuthLoginResult,
  AuthenticatedUser,
  Customer,
  UserAccount,
} from "@/types/domain";

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

function staffAccountToAuthenticatedUser(user: UserAccount): AuthenticatedUser {
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    role: user.roles.includes("SUPPORT") ? "support" : "admin",
  };
}

function getPasswordIdentifier(payload: AuthLoginRequest) {
  return (
    payload.identifier ??
    payload.email ??
    payload.username ??
    payload.phoneNumber ??
    ""
  )
    .trim()
    .toLowerCase();
}

function isPrecreatedStaffUser(user: UserAccount) {
  return (
    user.authProvider === "ACTIVE_DIRECTORY" &&
    user.status === "ACTIVE" &&
    !user.isLocked &&
    user.roles.some((role) =>
      ["SUPER_ADMIN", "ADMIN", "SUPPORT"].includes(role),
    )
  );
}

function findPrecreatedStaffByLanId(rawIdentifier: string) {
  const identifier = rawIdentifier.trim().toLowerCase();

  if (!identifier || identifier.includes("@")) {
    return null;
  }

  return (
    staffUsers.find(
      (user) =>
        isPrecreatedStaffUser(user) &&
        user.externalId?.trim().toLowerCase() === identifier,
    ) ?? null
  );
}

function findPrecreatedStaffByEmail(rawIdentifier: string) {
  const identifier = rawIdentifier.trim().toLowerCase();

  if (!identifier.includes("@")) {
    return null;
  }

  return (
    staffUsers.find(
      (user) =>
        isPrecreatedStaffUser(user) && user.email.toLowerCase() === identifier,
    ) ?? null
  );
}

function findDemoStaffByRole(role: "admin" | "support") {
  return (
    staffUsers.find((user) => {
      if (!isPrecreatedStaffUser(user)) {
        return false;
      }

      return role === "support"
        ? user.roles.includes("SUPPORT")
        : user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");
    }) ?? null
  );
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
    const identifier = getPasswordIdentifier(payload);
    const staffUser = findPrecreatedStaffByLanId(identifier);

    if (staffUser) {
      return staffAccountToAuthenticatedUser(staffUser);
    }

    return customerToAuthenticatedUser(
      findCustomerByIdentifier(identifier) ?? customers[0],
    );
  }

  if (payload.method === "passkey") {
    const credentialId = payload.credentialId?.trim().toLowerCase() ?? "";

    if (credentialId.includes("admin") || credentialId.includes("ops")) {
      const staffUser = findDemoStaffByRole("admin");

      if (staffUser) {
        return staffAccountToAuthenticatedUser(staffUser);
      }
    }

    if (credentialId.includes("support")) {
      const staffUser = findDemoStaffByRole("support");

      if (staffUser) {
        return staffAccountToAuthenticatedUser(staffUser);
      }
    }
  }

  return customerToAuthenticatedUser(customers[0]);
}

export function resolveDemoPasswordLoginUser(
  payload: AuthLoginRequest,
): AuthenticatedUser | null {
  const identifier = getPasswordIdentifier(payload);
  const staffUser = findPrecreatedStaffByLanId(identifier);

  if (staffUser) {
    return staffAccountToAuthenticatedUser(staffUser);
  }

  if (findPrecreatedStaffByEmail(identifier)) {
    return null;
  }

  const user = resolveDemoLoginUser(payload);
  const expectedPassword = demoPasswordsByEmail[identifier];

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
      customer.tin?.toLowerCase() === identifier ||
      businessPhoneDigits === phoneDigits ||
      contactPhoneDigits === phoneDigits
    );
  });
}
