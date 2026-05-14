import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentMethod, PaymentSessionStatus } from '../dto/bulk-data.dto';
import { BulkPaymentSessionEntity, BulkTransactionEntity } from '../entities';
import {
  buildMomoSpTransferHeaders,
  buildMomoSpTransferRequestDetails,
  getMomoProviderMode,
} from './bulk-data-sptransfer-provider';

const originalEnv = process.env;

describe('bulk data MoMo SP transfer helpers', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('selects SP transfer only for the MoMo provider mode', () => {
    process.env.PAYMENT_MOMO_PROVIDER_MODE = 'sp_transfer';

    expect(getMomoProviderMode()).toBe('sptransfer');
  });

  it('builds the ECW SP transfer payload for mobile money', () => {
    process.env.PAYMENT_MOMO_ECW_URL = 'http://ecw.local/api';
    process.env.PAYMENT_MOMO_SPTRANSFER_TO_FRI = 'homeint.mtn/USER';

    const details = buildMomoSpTransferRequestDetails(
      paymentSession(),
      transaction(),
      '+256771234567',
    );

    expect(details.url).toBe('http://ecw.local/api/sptransfer/');
    expect(details.body).toEqual({
      FromFri: '256771234567',
      ToFri: 'homeint.mtn/USER',
      Amount: 200000,
      Currency: 'UGX',
      ExternalTransactionId: 20260513001,
      ReferenceId: 'txn-20260513-001',
    });
    expect(details.providerTransactionId).toBe('20260513001');
    expect(details.providerReference).toBe('txn-20260513-001');
  });

  it('requires a mobile money SP transfer destination account', () => {
    process.env.PAYMENT_MOMO_SPTRANSFER_URL =
      'http://ecw.local/api/sptransfer/';
    delete process.env.PAYMENT_MOMO_SPTRANSFER_TO_FRI;

    expect(() =>
      buildMomoSpTransferRequestDetails(
        paymentSession(),
        transaction(),
        '+256771234567',
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('does not add auth headers for ECW SP transfer', () => {
    expect(
      buildMomoSpTransferHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    ).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });
});

function paymentSession(): BulkPaymentSessionEntity {
  return {
    id: 'pay-001',
    transactionId: 'txn-20260513-001',
    paymentMethod: PaymentMethod.MOBILE_MONEY,
    status: PaymentSessionStatus.AWAITING_PAYMENT,
    amountUgx: 200000,
    currency: 'UGX',
    socketEvent: 'payment.status',
    socketRoom: 'payments:pay-001',
    expiresAt: new Date('2026-05-13T10:00:00.000Z'),
    createdAt: new Date('2026-05-13T09:45:00.000Z'),
    customerId: 'cus-001',
    bundleId: 'bundle-001',
    provisioningCount: 1,
  };
}

function transaction(): BulkTransactionEntity {
  return {
    id: 'txn-20260513-001',
    customerId: 'cus-001',
    customerName: 'WaveNet',
    primaryMsisdn: '+256779999707',
    bundleId: 'bundle-001',
    bundleName: 'FWA 20Mbps',
    paymentMethod: PaymentMethod.MOBILE_MONEY,
    amountUgx: 200000,
    status: 'pending',
    createdAt: new Date('2026-05-13T09:45:00.000Z'),
  } as BulkTransactionEntity;
}
