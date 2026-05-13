import { BulkPaymentSessionEntity, BulkTransactionEntity } from '../entities';
import {
  serializePaymentSession,
  serializeTransaction,
} from './bulk-data-serializers';

export function buildPurchaseConfirmationResult(
  transaction: BulkTransactionEntity,
  session: BulkPaymentSessionEntity,
  confirmed: boolean,
  provisioningResult?: unknown,
) {
  return {
    transaction: serializeTransaction(transaction),
    paymentSession: serializePaymentSession(session),
    provisioningRequest: {
      subscribeService: confirmed,
      modifySubSubscription: confirmed && session.provisioningCount > 1,
      srvTopupCount: confirmed ? Math.max(session.provisioningCount - 1, 0) : 0,
      providerResult: provisioningResult,
    },
  };
}
