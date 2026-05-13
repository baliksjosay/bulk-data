export const PROVISIONING_UGANDA_MSISDN_PATTERN =
  /^256(?:77|78|79|76|39)\d{7}$/;

export function normalizeProvisioningMsisdn(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(/^\+/, '');
}

export function maskProvisioningMsisdn(msisdn: string): string {
  const normalized = normalizeProvisioningMsisdn(msisdn);

  if (normalized.length <= 6) {
    return normalized;
  }

  return `${normalized.slice(0, 6)}******${normalized.slice(-2)}`;
}

export function normalizeTrimmedString(value: string): string {
  return value.trim();
}

export function normalizeProviderResponseBody(
  body: unknown,
): Record<string, unknown> | null {
  if (body === null || body === undefined) {
    return null;
  }

  if (Array.isArray(body)) {
    return { items: body };
  }

  if (typeof body === 'object') {
    return body as Record<string, unknown>;
  }

  return { value: body };
}
