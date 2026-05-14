import { BadGatewayException } from '@nestjs/common';
import { BulkPaymentSessionEntity, BulkTransactionEntity } from '../entities';

export type AirtimeUpdateBalanceRequest = {
  originTimeStamp: string;
  originTransactionID: string;
  subscriberNumber: string;
  adjustmentAmountRelative: string;
};

export type AirtimeUpdateBalanceResponse = {
  originTransactionID?: unknown;
  accountValue1?: unknown;
  responseCode?: unknown;
};

export function buildAirtimeUpdateBalanceUrl() {
  const explicitUrl = process.env.PAYMENT_AIRTIME_PROVIDER_INIT_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = (
    process.env.BULK_DATA_API_BASE_URL ??
    process.env.PROVISIONING_PCRF_BASE_URL ??
    ''
  ).trim();

  if (!baseUrl) {
    return '';
  }

  const path = (
    process.env.PAYMENT_AIRTIME_UPDATE_BALANCE_PATH ??
    '/api/update-balance-and-date'
  ).trim();

  return new URL(path.replace(/^\/+/, ''), ensureTrailingSlash(baseUrl))
    .toString()
    .trim();
}

export function buildAirtimeUpdateBalanceRequest(
  session: BulkPaymentSessionEntity,
  transaction: BulkTransactionEntity,
): AirtimeUpdateBalanceRequest {
  return {
    originTimeStamp: formatAirtimeOriginTimestamp(),
    originTransactionID: buildAirtimeOriginTransactionId(transaction.id),
    subscriberNumber: normalizeAirtimeSubscriberNumber(
      transaction.primaryMsisdn,
    ),
    adjustmentAmountRelative: `${Math.trunc(Math.abs(Number(session.amountUgx)))}`,
  };
}

export function assertAirtimeUpdateBalanceAccepted(
  body: AirtimeUpdateBalanceResponse,
) {
  if (body.responseCode === undefined || body.responseCode === null) {
    return;
  }

  if (Number(body.responseCode) !== 0) {
    throw new BadGatewayException('Airtime provider rejected the deduction');
  }
}

function formatAirtimeOriginTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.year}${parts.month}${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+0300`;
}

function normalizeAirtimeSubscriberNumber(msisdn: string) {
  return msisdn.trim().replace(/^\+/, '');
}

function buildAirtimeOriginTransactionId(transactionId: string) {
  const numeric = transactionId.replace(/\D/g, '');
  return numeric || Date.now().toString();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}
