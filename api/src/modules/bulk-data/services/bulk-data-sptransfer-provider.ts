import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BulkPaymentSessionEntity, BulkTransactionEntity } from '../entities';

export type SpTransferProviderMode = 'provider' | 'sptransfer';

export type SpTransferRequest = {
  FromFri: string;
  ToFri: string;
  Amount: number;
  Currency: 'UGX';
  ExternalTransactionId: number;
  ReferenceId: string;
};

export type SpTransferResponse = {
  status?: unknown;
  statusCode?: unknown;
  success?: unknown;
  successful?: unknown;
  resultCode?: unknown;
  responseCode?: unknown;
  message?: unknown;
  transactionId?: unknown;
  data?: SpTransferResponse;
  result?: SpTransferResponse;
};

export type SpTransferRequestDetails = {
  url: string;
  body: SpTransferRequest;
  providerReference: string;
  providerTransactionId: string;
};

export function getMomoProviderMode(): SpTransferProviderMode {
  const configuredMode = (process.env.PAYMENT_MOMO_PROVIDER_MODE ?? 'provider')
    .trim()
    .toLowerCase();

  return configuredMode === 'sptransfer' || configuredMode === 'sp_transfer'
    ? 'sptransfer'
    : 'provider';
}

export function buildMomoSpTransferRequestDetails(
  session: BulkPaymentSessionEntity,
  transaction: BulkTransactionEntity,
  payingMsisdn: string,
): SpTransferRequestDetails {
  const toFri = process.env.PAYMENT_MOMO_SPTRANSFER_TO_FRI?.trim();

  if (!toFri) {
    throw new ServiceUnavailableException(
      'Mobile money SP transfer destination account is not configured',
    );
  }

  const externalTransactionId = buildNumericTransactionId(transaction.id);
  const fromFri =
    process.env.PAYMENT_MOMO_SPTRANSFER_FROM_FRI?.trim() ||
    normalizeMsisdn(payingMsisdn);

  return {
    url: buildMomoSpTransferUrl(),
    body: {
      FromFri: fromFri,
      ToFri: toFri,
      Amount: Math.trunc(Math.abs(Number(session.amountUgx))),
      Currency: 'UGX',
      ExternalTransactionId: externalTransactionId,
      ReferenceId: transaction.id,
    },
    providerTransactionId: String(externalTransactionId),
    providerReference: transaction.id,
  };
}

export function buildMomoSpTransferUrl() {
  const explicitUrl = process.env.PAYMENT_MOMO_SPTRANSFER_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = (
    process.env.PAYMENT_MOMO_SPTRANSFER_BASE_URL ??
    process.env.ECW_API_URL ??
    ''
  ).trim();

  if (!baseUrl) {
    return '';
  }

  const path = (process.env.PAYMENT_MOMO_SPTRANSFER_PATH ?? '/sptransfer/')
    .trim()
    .replace(/^\/+/, '');

  return new URL(path, ensureTrailingSlash(baseUrl)).toString().trim();
}

export function buildMomoSpTransferHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const username = (
    process.env.PAYMENT_MOMO_SPTRANSFER_USERNAME ??
    process.env.PAYMENT_MOMO_SPTRANSFER_TO_FRI ??
    ''
  ).trim();
  const password = process.env.PAYMENT_MOMO_SPTRANSFER_PASSWORD ?? '';

  if (!username || !password) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString(
      'base64',
    )}`,
  };
}

export function assertSpTransferAccepted(body: SpTransferResponse) {
  const statusCode = numberFrom(body.statusCode ?? body.status);

  if (statusCode !== undefined && statusCode >= 400) {
    throw new BadGatewayException(
      'Mobile money SP transfer provider rejected payment',
    );
  }

  const resultCode = numberFrom(body.resultCode ?? body.responseCode);

  if (resultCode !== undefined && resultCode !== 0) {
    throw new BadGatewayException(
      'Mobile money SP transfer provider rejected payment',
    );
  }

  if (body.success === undefined && body.successful === undefined) {
    return;
  }

  const success = String(body.success ?? body.successful).toLowerCase();

  if (!['true', 'success', 'successful'].includes(success)) {
    throw new BadGatewayException(
      'Mobile money SP transfer provider rejected payment',
    );
  }
}

export function extractSpTransferReferences(
  body: SpTransferResponse,
  request: SpTransferRequestDetails,
) {
  const providerTransactionId =
    stringFrom(
      body.data?.transactionId ??
        body.transactionId ??
        body.result?.transactionId,
    ) ?? request.providerTransactionId;

  return {
    providerTransactionId,
    providerReference: request.providerReference,
  };
}

function normalizeMsisdn(msisdn: string) {
  return msisdn.trim().replace(/^\+/, '');
}

function buildNumericTransactionId(transactionId: string) {
  const numeric = transactionId.replace(/\D/g, '');
  return Number(numeric || Date.now().toString());
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function numberFrom(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : undefined;
}
