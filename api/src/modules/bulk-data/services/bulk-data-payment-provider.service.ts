import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PaymentMethod, PaymentSessionStatus } from '../dto/bulk-data.dto';
import {
  BulkBundleEntity,
  BulkPaymentSessionEntity,
  BulkTransactionEntity,
} from '../entities';
import { BulkPaymentSessionsRepository } from '../repositories';
import { sequenceId } from './bulk-data-query';
import {
  buildApiUrl,
  buildMockProviderCheckoutUrl,
  buildPaymentReturnUrl,
} from './bulk-data-payment-url';
import {
  PaymentProviderInitiationBody,
  PaymentSessionOptions,
} from './bulk-data.types';
import {
  assertAirtimeUpdateBalanceAccepted,
  buildAirtimeUpdateBalanceRequest,
  buildAirtimeUpdateBalanceUrl,
} from './bulk-data-airtime-provider';
import { BulkDataPrnProviderService } from './bulk-data-prn-provider.service';
import {
  assertSpTransferAccepted,
  buildMomoSpTransferHeaders,
  buildMomoSpTransferRequestDetails,
  extractSpTransferReferences,
  getMomoProviderMode,
} from './bulk-data-sptransfer-provider';

@Injectable()
export class BulkDataPaymentProviderService {
  constructor(
    private readonly paymentSessions: BulkPaymentSessionsRepository,
    private readonly prnProvider: BulkDataPrnProviderService,
  ) {}

  async createPaymentSession(
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
    provisioningCount: number,
    options: PaymentSessionOptions = {},
  ) {
    const id = sequenceId('pay');
    const session = await this.paymentSessions.save(
      this.paymentSessions.create({
        id,
        transactionId: transaction.id,
        paymentMethod: transaction.paymentMethod,
        status: PaymentSessionStatus.AWAITING_PAYMENT,
        amountUgx: transaction.amountUgx,
        currency: 'UGX',
        prn: undefined,
        provider: options.prnProvider as never,
        providerTransactionId: undefined,
        providerReference: undefined,
        providerGeneratedAt: undefined,
        paymentUrl: undefined,
        socketEvent: 'payment.status',
        socketRoom: `payments:${id}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        customerId: transaction.customerId,
        bundleId: bundle.id,
        provisioningCount,
      }),
    );

    if (transaction.paymentMethod === PaymentMethod.PRN) {
      await this.createPrnPaymentReference(
        session,
        transaction,
        bundle,
        options,
      );
      return this.paymentSessions.save(session);
    }

    if (transaction.paymentMethod === PaymentMethod.MOBILE_MONEY) {
      await this.initiateMobileMoneyPayment(
        session,
        transaction,
        bundle,
        options,
      );
      return this.paymentSessions.save(session);
    }

    if (transaction.paymentMethod === PaymentMethod.AIRTIME) {
      await this.initiateAirtimePayment(session, transaction);
      return this.paymentSessions.save(session);
    }

    if (transaction.paymentMethod !== PaymentMethod.CARD) {
      return session;
    }

    session.paymentUrl = await this.createCardPaymentUrl(
      session,
      transaction,
      bundle,
      options,
    );

    return this.paymentSessions.save(session);
  }

  private async createCardPaymentUrl(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
    options: PaymentSessionOptions,
  ) {
    const providerInitUrl = process.env.PAYMENT_PROVIDER_INIT_URL?.trim();

    if (!providerInitUrl) {
      return buildMockProviderCheckoutUrl(session, options.redirectUrl);
    }

    const body = await this.postProviderRequest(
      providerInitUrl,
      this.defaultPaymentHeaders(),
      {
        sessionId: session.id,
        transactionId: transaction.id,
        amount: Number(session.amountUgx),
        amountUgx: Number(session.amountUgx),
        currency: session.currency,
        paymentMethod: session.paymentMethod,
        customerId: transaction.customerId,
        bundleId: bundle.id,
        bundleName: bundle.name,
        serviceCode: bundle.serviceCode,
        provisioningCount: session.provisioningCount,
        autoRenew: options.autoRenew ?? false,
        callbackUrl: buildApiUrl('/api/payments/callback'),
        returnUrl: options.redirectUrl ?? buildPaymentReturnUrl(session),
        expiresAt: session.expiresAt.toISOString(),
      },
      'Payment provider initiation failed',
      this.providerTimeoutMs('PAYMENT_PROVIDER_TIMEOUT_MS'),
    );
    const providerUrl = this.extractProviderPaymentUrl(body);

    if (!providerUrl) {
      throw new BadGatewayException(
        'Payment provider did not return a checkout URL',
      );
    }

    return new URL(providerUrl, providerInitUrl).toString();
  }

  private async createPrnPaymentReference(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
    options: PaymentSessionOptions,
  ) {
    const prnDetails = await this.prnProvider.generateReference(
      session,
      transaction,
      bundle,
      options,
    );

    session.prn = prnDetails.paymentReference;
    session.providerReference = prnDetails.paymentReference;
    session.providerTransactionId = prnDetails.internalTransactionId;
    session.providerGeneratedAt = prnDetails.generationDateTime;

    if (prnDetails.expirationDateTime) {
      session.expiresAt = prnDetails.expirationDateTime;
    }
  }

  private async initiateMobileMoneyPayment(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
    options: PaymentSessionOptions,
  ) {
    if (!options.payingMsisdn) {
      throw new BadRequestException(
        'payingMsisdn is required for mobile money payments',
      );
    }

    if (getMomoProviderMode() === 'sptransfer') {
      await this.initiateMobileMoneySpTransfer(
        session,
        transaction,
        options.payingMsisdn,
      );
      return;
    }

    const providerInitUrl = process.env.PAYMENT_MOMO_PROVIDER_INIT_URL?.trim();

    if (!providerInitUrl) {
      return;
    }

    await this.postProviderRequest(
      providerInitUrl,
      this.channelPaymentHeaders('MOMO'),
      {
        sessionId: session.id,
        transactionId: transaction.id,
        amount: Number(session.amountUgx),
        amountUgx: Number(session.amountUgx),
        currency: session.currency,
        paymentMethod: session.paymentMethod,
        payingMsisdn: options.payingMsisdn,
        customerId: transaction.customerId,
        customerName: transaction.customerName,
        primaryMsisdn: transaction.primaryMsisdn,
        bundleId: bundle.id,
        bundleName: bundle.name,
        serviceCode: bundle.serviceCode,
        provisioningCount: session.provisioningCount,
        autoRenew: options.autoRenew ?? false,
        callbackUrl: buildApiUrl('/api/payments/callback'),
        returnUrl: options.redirectUrl ?? buildPaymentReturnUrl(session),
        expiresAt: session.expiresAt.toISOString(),
      },
      'Mobile money provider initiation failed',
      this.providerTimeoutMs(
        'PAYMENT_MOMO_PROVIDER_TIMEOUT_MS',
        'PAYMENT_PROVIDER_TIMEOUT_MS',
      ),
    );
  }

  private async initiateMobileMoneySpTransfer(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
    payingMsisdn: string,
  ) {
    const request = buildMomoSpTransferRequestDetails(
      session,
      transaction,
      payingMsisdn,
    );

    if (!request.url) {
      return;
    }

    session.providerTransactionId = request.providerTransactionId;
    session.providerReference = request.providerReference;

    const body = await this.postProviderRequest(
      request.url,
      buildMomoSpTransferHeaders(this.channelPaymentHeaders('MOMO')),
      request.body,
      'Mobile money SP transfer initiation failed',
      this.providerTimeoutMs(
        'PAYMENT_MOMO_PROVIDER_TIMEOUT_MS',
        'PAYMENT_PROVIDER_TIMEOUT_MS',
      ),
    );
    assertSpTransferAccepted(body);

    const references = extractSpTransferReferences(body, request);
    session.providerTransactionId = references.providerTransactionId;
    session.providerReference = references.providerReference;
  }

  private async initiateAirtimePayment(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
  ) {
    const providerInitUrl = buildAirtimeUpdateBalanceUrl();

    if (!providerInitUrl) {
      return;
    }

    const request = buildAirtimeUpdateBalanceRequest(session, transaction);
    session.providerTransactionId = request.originTransactionID;
    session.providerReference = request.originTransactionID;

    const body = await this.postProviderRequest(
      providerInitUrl,
      this.channelPaymentHeaders('AIRTIME'),
      request,
      'Airtime provider initiation failed',
      this.providerTimeoutMs(
        'PAYMENT_AIRTIME_PROVIDER_TIMEOUT_MS',
        'PAYMENT_PROVIDER_TIMEOUT_MS',
      ),
    );
    assertAirtimeUpdateBalanceAccepted(body);
  }

  private async postProviderRequest(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    errorPrefix: string,
    timeoutMs: number,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const providerMessage = await response.text().catch(() => '');
        throw new BadGatewayException(
          `${errorPrefix} (${response.status})${
            providerMessage ? `: ${providerMessage.slice(0, 180)}` : ''
          }`,
        );
      }

      return (await response
        .json()
        .catch(() => ({}))) as PaymentProviderInitiationBody;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(errorPrefix);
    } finally {
      clearTimeout(timeout);
    }
  }

  private defaultPaymentHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const bearerToken = process.env.PAYMENT_PROVIDER_BEARER_TOKEN?.trim();
    const apiKey = process.env.PAYMENT_PROVIDER_API_KEY?.trim();

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  private providerTimeoutMs(primaryKey: string, fallbackKey?: string) {
    return Number.parseInt(
      process.env[primaryKey] ??
        (fallbackKey ? process.env[fallbackKey] : '') ??
        '15000',
      10,
    );
  }

  private channelPaymentHeaders(channel: 'PRN' | 'MOMO' | 'AIRTIME') {
    const headers = this.defaultPaymentHeaders();
    const bearerToken =
      process.env[`PAYMENT_${channel}_PROVIDER_BEARER_TOKEN`]?.trim();
    const apiKey = process.env[`PAYMENT_${channel}_PROVIDER_API_KEY`]?.trim();

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  private extractProviderPaymentUrl(
    body: PaymentProviderInitiationBody,
  ): string | undefined {
    const direct =
      body.paymentUrl ?? body.checkoutUrl ?? body.redirectUrl ?? body.url;

    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    return body.data
      ? this.extractProviderPaymentUrl(body.data)
      : body.result
        ? this.extractProviderPaymentUrl(body.result)
        : undefined;
  }
}
