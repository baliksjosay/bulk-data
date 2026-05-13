import { BulkPaymentSessionEntity } from '../entities';

export function buildApiUrl(path: string) {
  const baseUrl =
    process.env.PAYMENT_CALLBACK_BASE_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    process.env.API_URL?.trim() ||
    'http://localhost:9088';

  return new URL(path, baseUrl).toString();
}

export function buildPaymentReturnUrl(session: BulkPaymentSessionEntity) {
  const frontendUrl =
    process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  const url = new URL('/payment-status', frontendUrl);

  url.searchParams.set('transactionId', session.transactionId);
  url.searchParams.set('sessionId', session.id);

  return url.toString();
}

export function buildMockProviderCheckoutUrl(
  session: BulkPaymentSessionEntity,
  redirectUrl?: string,
) {
  const url = new URL(
    `/api/payments/provider-checkout/${encodeURIComponent(session.id)}`,
    buildApiUrl('/'),
  );

  url.searchParams.set(
    'returnUrl',
    redirectUrl ?? buildPaymentReturnUrl(session),
  );

  return url.toString();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
