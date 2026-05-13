import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BundleStatus,
  PaymentMethod,
  PaymentSessionStatus,
  TransactionStatus,
} from '../dto/bulk-data.dto';
import {
  BulkBundleEntity,
  BulkPaymentSessionEntity,
  BulkTransactionEntity,
} from '../entities';
import { BulkDataPrnProviderService } from './bulk-data-prn-provider.service';

describe('BulkDataPrnProviderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a mock PRN when no provider URL is configured', async () => {
    const adapter = createAdapter({});

    await expect(
      adapter.generateReference(paymentSession(), transaction(), bundle(), {
        prnProvider: 'bank',
      }),
    ).resolves.toMatchObject({
      paymentReference: 'PRN-BANK-001',
      generationDateTime: expect.any(Date),
    });
  });

  it('posts the Generate PRN request and maps provider response', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        internalTransactionId: '6bc9766c-4f33-4493-a22c-1cc52c7ac365',
        clientTransactionId: 'txn-20260513-001',
        paymentReference: 'A2086517260219',
        generationDateTime: '2026-02-19T14:30:00',
        expirationDateTime: '2026-02-26T14:27:06',
      }),
    } as Response);
    const adapter = createAdapter({
      'payments.prnProvider.initUrl':
        'http://10.156.42.7:9040/api/payment/reference',
      'payments.prnProvider.apiKey': 'prn-key',
      'payments.prnProvider.timeoutMs': 60000,
    });

    const result = await adapter.generateReference(
      paymentSession(),
      transaction(),
      bundle(),
      { additionalInfo: 'Customer requested weekend bundle' },
    );

    expect(result).toMatchObject({
      internalTransactionId: '6bc9766c-4f33-4493-a22c-1cc52c7ac365',
      clientTransactionId: 'txn-20260513-001',
      paymentReference: 'A2086517260219',
      generationDateTime: expect.any(Date),
      expirationDateTime: expect.any(Date),
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://10.156.42.7:9040/api/payment/reference',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'prn-key',
        },
        body: JSON.stringify({
          customerMsisdn: '256779999707',
          customerName: 'WaveNet',
          productCode: 'FWA_20MBPS',
          productName: 'FWA 20Mbps',
          amount: 200000,
          payingCurrency: 'UGX',
          transactionId: 'txn-20260513-001',
          additionalInfo: 'Customer requested weekend bundle',
        }),
      }),
    );
  });

  it('rejects mismatched provider transaction references', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        clientTransactionId: 'other-transaction',
        paymentReference: 'A2086517260219',
      }),
    } as Response);
    const adapter = createAdapter({
      'payments.prnProvider.initUrl':
        'http://10.156.42.7:9040/api/payment/reference',
    });

    await expect(
      adapter.generateReference(paymentSession(), transaction(), bundle(), {}),
    ).rejects.toThrow(BadGatewayException);
  });
});

function createAdapter(config: Record<string, unknown>) {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;

  return new BulkDataPrnProviderService(configService);
}

function paymentSession(): BulkPaymentSessionEntity {
  return {
    id: 'pay-001',
    transactionId: 'txn-20260513-001',
    paymentMethod: PaymentMethod.PRN,
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
    paymentMethod: PaymentMethod.PRN,
    amountUgx: 200000,
    status: TransactionStatus.PENDING,
    createdAt: new Date('2026-05-13T09:45:00.000Z'),
  };
}

function bundle(): BulkBundleEntity {
  return {
    id: 'bundle-001',
    name: 'FWA 20Mbps',
    volumeTb: 1,
    priceUgx: 200000,
    validityDays: 30,
    serviceCode: 'FWA_20MBPS',
    status: BundleStatus.ACTIVE,
    visible: true,
    createdAt: new Date('2026-05-13T09:45:00.000Z'),
    updatedAt: new Date('2026-05-13T09:45:00.000Z'),
  };
}
