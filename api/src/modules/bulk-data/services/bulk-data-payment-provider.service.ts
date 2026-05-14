import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  durationSince,
  integrationTargetHost,
  logIntegrationEvent,
} from 'src/common/logging/integration-logger';
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

type PaymentProviderLogOptions = {
  provider: string;
  operation: string;
  requestId?: string;
  referenceId?: string;
};

@Injectable()
export class BulkDataPaymentProviderService {
  private readonly logger = new Logger(BulkDataPaymentProviderService.name);

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
    const providerInitUrl = buildCardProviderInitUrl();

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
      {
        provider: 'card',
        operation: 'initiate_checkout',
        requestId: session.id,
        referenceId: transaction.id,
      },
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
      this.channelPaymentHeaders(),
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
      {
        provider: 'momo',
        operation: 'initiate_payment',
        requestId: session.id,
        referenceId: transaction.id,
      },
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
      buildMomoSpTransferHeaders(this.channelPaymentHeaders()),
      request.body,
      'Mobile money SP transfer initiation failed',
      this.providerTimeoutMs(
        'PAYMENT_MOMO_PROVIDER_TIMEOUT_MS',
        'PAYMENT_PROVIDER_TIMEOUT_MS',
      ),
      {
        provider: 'sptransfer',
        operation: 'initiate_payment',
        requestId: session.id,
        referenceId: request.providerTransactionId,
      },
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
      this.channelPaymentHeaders(),
      request,
      'Airtime provider initiation failed',
      this.providerTimeoutMs(
        'PAYMENT_AIRTIME_PROVIDER_TIMEOUT_MS',
        'PAYMENT_PROVIDER_TIMEOUT_MS',
      ),
      {
        provider: 'airtime',
        operation: 'update_balance_and_date',
        requestId: session.id,
        referenceId: request.originTransactionID,
      },
    );
    assertAirtimeUpdateBalanceAccepted(body);
  }

  private async postProviderRequest(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    errorPrefix: string,
    timeoutMs: number,
    logOptions: PaymentProviderLogOptions,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const targetHost = integrationTargetHost(url);

    logIntegrationEvent(this.logger, {
      provider: logOptions.provider,
      operation: logOptions.operation,
      outcome: 'started',
      requestId: logOptions.requestId,
      referenceId: logOptions.referenceId,
      targetHost,
      context: { timeoutMs },
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const providerMessage = await response.text().catch(() => '');
        logIntegrationEvent(this.logger, {
          provider: logOptions.provider,
          operation: logOptions.operation,
          outcome: 'failed',
          requestId: logOptions.requestId,
          referenceId: logOptions.referenceId,
          targetHost,
          statusCode: response.status,
          durationMs: durationSince(startedAt),
          errorMessage: 'Provider returned non-success status',
        });
        throw new BadGatewayException(
          `${errorPrefix} (${response.status})${
            providerMessage ? `: ${providerMessage.slice(0, 180)}` : ''
          }`,
        );
      }

      const responseBody = (await response
        .json()
        .catch(() => ({}))) as PaymentProviderInitiationBody;

      logIntegrationEvent(this.logger, {
        provider: logOptions.provider,
        operation: logOptions.operation,
        outcome: 'succeeded',
        requestId: logOptions.requestId,
        referenceId: logOptions.referenceId,
        targetHost,
        statusCode: response.status,
        durationMs: durationSince(startedAt),
      });

      return responseBody;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      logIntegrationEvent(this.logger, {
        provider: logOptions.provider,
        operation: logOptions.operation,
        outcome: 'failed',
        requestId: logOptions.requestId,
        referenceId: logOptions.referenceId,
        targetHost,
        durationMs: durationSince(startedAt),
        errorCode: error instanceof Error ? error.name : undefined,
        errorMessage: 'Provider request failed',
      });
      throw new BadGatewayException(errorPrefix);
    } finally {
      clearTimeout(timeout);
    }
  }

  private defaultPaymentHeaders() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private providerTimeoutMs(primaryKey: string, fallbackKey?: string) {
    return Number.parseInt(
      process.env[primaryKey] ??
        (fallbackKey ? process.env[fallbackKey] : undefined) ??
        process.env.BULK_DATA_API_TIMEOUT_MS ??
        '15000',
      10,
    );
  }

  private channelPaymentHeaders() {
    return this.defaultPaymentHeaders();
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

function buildCardProviderInitUrl() {
  const explicitUrl = process.env.PAYMENT_PROVIDER_INIT_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  return buildBulkDataApiUrl(process.env.PAYMENT_CARD_PROVIDER_INIT_PATH);
}

function buildBulkDataApiUrl(path?: string) {
  const baseUrl = (
    process.env.BULK_DATA_API_BASE_URL ??
    process.env.PROVISIONING_PCRF_BASE_URL ??
    ''
  ).trim();
  const normalizedPath = path?.trim();

  if (!baseUrl || !normalizedPath) {
    return '';
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return new URL(normalizedPath.replace(/^\/+/, ''), normalizedBase)
    .toString()
    .trim();
}
