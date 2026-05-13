import { PaymentSessionStatus } from '../dto/bulk-data.dto';

export type ApiEnvelope<T> = {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type MsisdnValidationResult = {
  msisdn: string;
  accepted: boolean;
  reason: string;
  apnIds: string[];
  registeredApnId: string;
  provisioningAction?:
    | 'addSubscriber'
    | 'addGroupMember'
    | 'addMultipleGroupMember';
};

export type PaymentSessionOptions = {
  prnProvider?: string;
  payingMsisdn?: string;
  redirectUrl?: string;
  autoRenew?: boolean;
  additionalInfo?: string;
};

export type PaymentProviderInitiationBody = {
  paymentUrl?: unknown;
  checkoutUrl?: unknown;
  redirectUrl?: unknown;
  url?: unknown;
  prn?: unknown;
  paymentReference?: unknown;
  reference?: unknown;
  providerReference?: unknown;
  internalTransactionId?: unknown;
  clientTransactionId?: unknown;
  generationDateTime?: unknown;
  expirationDateTime?: unknown;
  originTransactionID?: unknown;
  accountValue1?: unknown;
  responseCode?: unknown;
  status?: unknown;
  statusCode?: unknown;
  success?: unknown;
  successful?: unknown;
  resultCode?: unknown;
  message?: unknown;
  transactionId?: unknown;
  data?: PaymentProviderInitiationBody;
  result?: PaymentProviderInitiationBody;
};

export type PaymentStatusUpdate = {
  status: PaymentSessionStatus;
  message: string;
  receiptNumber?: string;
};

export const nowIso = () => new Date().toISOString();
