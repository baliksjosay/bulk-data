import { BadRequestException } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentProviderCallbackDto,
  PaymentSessionStatus,
} from '../dto/bulk-data.dto';

export function buildPaymentCallbackLookup(dto: PaymentProviderCallbackDto) {
  const lookup = {
    sessionId: dto.sessionId,
    transactionId: dto.transactionId ?? dto.clientTransactionId,
    providerTransactionId: dto.internalTransactionId,
    providerReference: dto.paymentReference ?? dto.providerReference,
  };

  if (!Object.values(lookup).some(Boolean)) {
    throw new BadRequestException('Payment callback identifier is required');
  }

  return lookup;
}

export function getPaymentCallbackTransactionId(
  dto: PaymentProviderCallbackDto,
) {
  return dto.transactionId ?? dto.clientTransactionId;
}

export function getPaymentCallbackReceiptNumber(
  dto: PaymentProviderCallbackDto,
) {
  return dto.receiptNumber ?? dto.paymentReference ?? dto.providerReference;
}

export function normalizeProviderPaymentStatus(
  status: PaymentProviderCallbackDto['status'],
  paymentMethod: PaymentMethod,
) {
  if (!status) {
    if (paymentMethod === PaymentMethod.PRN) {
      return PaymentSessionStatus.CONFIRMED;
    }

    throw new BadRequestException('Payment callback status is required');
  }

  return status === 'paid' || status === 'approved' || status === 'deducted'
    ? PaymentSessionStatus.CONFIRMED
    : status;
}

export function isTerminalPaymentStatus(status: PaymentSessionStatus) {
  return [
    PaymentSessionStatus.CONFIRMED,
    PaymentSessionStatus.FAILED,
    PaymentSessionStatus.EXPIRED,
  ].includes(status);
}
