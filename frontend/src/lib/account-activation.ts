import {
  addAuditEvent,
  consumeAccountActivationPasswordToken,
  createAccountActivationOtp,
  customers,
  getAccountActivationRecord,
  verifyAccountActivationOtp,
} from "@/lib/fake-db";
import { customerToAuthenticatedUser, makeLoginResult } from "@/lib/demo-auth";
import type {
  AccountActivationOtpResult,
  AccountActivationOtpVerificationResult,
  AuthLoginResult,
} from "@/types/domain";

export function startAccountActivationOtp(token: string): AccountActivationOtpResult | null {
  const record = getAccountActivationRecord(token);

  if (!record) {
    return null;
  }

  const customer = customers.find((item) => item.id === record.customerId);

  if (!customer) {
    return null;
  }

  return createAccountActivationOtp(token, customer.email);
}

export function completeAccountActivationOtp(
  token: string,
  activationId: string,
  otp: string,
): AccountActivationOtpVerificationResult | null {
  return verifyAccountActivationOtp(token, activationId, otp);
}

export function completeAccountActivationPassword(passwordSetupToken: string): AuthLoginResult | null {
  const record = consumeAccountActivationPasswordToken(passwordSetupToken);

  if (!record) {
    return null;
  }

  const customer = customers.find((item) => item.id === record.customerId);

  if (!customer) {
    return null;
  }

  customer.status = "active";
  addAuditEvent({
    category: "security",
    action: "Customer account activated",
    actor: customer.email,
    outcome: "success",
  });

  return makeLoginResult(customerToAuthenticatedUser(customer), true);
}
