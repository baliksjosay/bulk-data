import { BadGatewayException } from '@nestjs/common';
import {
  BulkBundleEntity,
  BulkPaymentSessionEntity,
  BulkTransactionEntity,
} from '../entities';
import {
  PaymentProviderInitiationBody,
  PaymentSessionOptions,
} from './bulk-data.types';

export type PrnReferenceRequest = {
  customerMsisdn: string;
  customerName: string;
  productCode: string;
  productName: string;
  amount: number;
  payingCurrency: 'UGX';
  transactionId: string;
  additionalInfo: string;
};

export type PrnReferenceDetails = {
  internalTransactionId?: string;
  clientTransactionId?: string;
  paymentReference: string;
  generationDateTime?: Date;
  expirationDateTime?: Date;
};

export function buildPrnReferenceRequest(
  session: BulkPaymentSessionEntity,
  transaction: BulkTransactionEntity,
  bundle: BulkBundleEntity,
  options: PaymentSessionOptions,
): PrnReferenceRequest {
  return {
    customerMsisdn: normalizeMsisdn(
      options.payingMsisdn ?? transaction.primaryMsisdn,
    ),
    customerName: transaction.customerName,
    productCode: bundle.serviceCode,
    productName: bundle.name,
    amount: Number(session.amountUgx),
    payingCurrency: session.currency,
    transactionId: transaction.id,
    additionalInfo:
      options.additionalInfo ??
      `Bulk data purchase for ${bundle.name}; count=${session.provisioningCount}`,
  };
}

export function extractPrnReferenceDetails(
  body: PaymentProviderInitiationBody,
): PrnReferenceDetails {
  const nested = body.data ?? body.result;
  const directReference =
    body.paymentReference ??
    body.prn ??
    body.reference ??
    body.providerReference;

  if (nested && !directReference) {
    return extractPrnReferenceDetails(nested);
  }

  const paymentReference = pickString(directReference);

  if (!paymentReference) {
    throw new BadGatewayException('PRN provider did not return a PRN');
  }

  return {
    internalTransactionId: pickString(body.internalTransactionId),
    clientTransactionId: pickString(body.clientTransactionId),
    paymentReference,
    generationDateTime: parseProviderDate(body.generationDateTime),
    expirationDateTime: parseProviderDate(body.expirationDateTime),
  };
}

function normalizeMsisdn(msisdn: string) {
  return msisdn.trim().replace(/^\+/, '');
}

function pickString(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  return undefined;
}

function parseProviderDate(value: unknown) {
  const normalized = pickString(value);

  if (!normalized) {
    return undefined;
  }

  const hasExplicitOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const parsed = new Date(
    hasExplicitOffset ? normalized : `${normalized}+03:00`,
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
