import { BadGatewayException } from '@nestjs/common';
import { PaymentMethod, PaymentSessionStatus } from '../dto/bulk-data.dto';
import { BulkPaymentSessionEntity, BulkTransactionEntity } from '../entities';
import {
  assertAirtimeUpdateBalanceAccepted,
  buildAirtimeUpdateBalanceRequest,
  buildAirtimeUpdateBalanceUrl,
} from './bulk-data-airtime-provider';

const originalEnv = process.env;

describe('bulk data airtime provider helpers', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the configured update-balance URL unchanged', () => {
    process.env.PAYMENT_AIRTIME_PROVIDER_INIT_URL =
      'http://10.156.42.7:9040/api/update-balance-and-date';

    expect(buildAirtimeUpdateBalanceUrl()).toBe(
      'http://10.156.42.7:9040/api/update-balance-and-date',
    );
  });

  it('builds the update-balance payload shared for airtime', () => {
    const request = buildAirtimeUpdateBalanceRequest(
      paymentSession(),
      transaction(),
    );

    expect(request).toMatchObject({
      originTransactionID: '20260513001',
      subscriberNumber: '256779999707',
      adjustmentAmountRelative: '-200000',
    });
    expect(request.originTimeStamp).toMatch(/^\d{8}T\d{2}:\d{2}:\d{2}\+0300$/);
  });

  it('rejects non-zero airtime response codes', () => {
    expect(() =>
      assertAirtimeUpdateBalanceAccepted({ responseCode: 51 }),
    ).toThrow(BadGatewayException);
  });
});

function paymentSession(): BulkPaymentSessionEntity {
  return {
    id: 'pay-001',
    transactionId: 'txn-20260513-001',
    paymentMethod: PaymentMethod.AIRTIME,
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
    paymentMethod: PaymentMethod.AIRTIME,
    amountUgx: 200000,
    status: 'pending',
    createdAt: new Date('2026-05-13T09:45:00.000Z'),
  } as BulkTransactionEntity;
}
