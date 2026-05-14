import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  durationSince,
  integrationTargetHost,
  logIntegrationEvent,
} from 'src/common/logging/integration-logger';
import {
  BulkBundleEntity,
  BulkPaymentSessionEntity,
  BulkTransactionEntity,
} from '../entities';
import {
  PaymentProviderInitiationBody,
  PaymentSessionOptions,
} from './bulk-data.types';
import {
  buildPrnReferenceRequest,
  extractPrnReferenceDetails,
  PrnReferenceDetails,
} from './bulk-data-prn-provider';

@Injectable()
export class BulkDataPrnProviderService {
  private readonly logger = new Logger(BulkDataPrnProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReference(
    session: BulkPaymentSessionEntity,
    transaction: BulkTransactionEntity,
    bundle: BulkBundleEntity,
    options: PaymentSessionOptions,
  ): Promise<PrnReferenceDetails> {
    const providerInitUrl = this.getString('payments.prnProvider.initUrl');

    if (!providerInitUrl) {
      const mockPrn = this.buildMockPrnReference(session, options.prnProvider);

      return {
        paymentReference: mockPrn,
        generationDateTime: new Date(),
      };
    }

    const body = await this.postProviderRequest(
      providerInitUrl,
      this.jsonHeaders(),
      buildPrnReferenceRequest(session, transaction, bundle, options),
      this.timeoutMs(),
    );
    const prnDetails = extractPrnReferenceDetails(body);

    if (
      prnDetails.clientTransactionId &&
      prnDetails.clientTransactionId !== transaction.id
    ) {
      throw new BadGatewayException(
        'PRN provider returned mismatched reference',
      );
    }

    return prnDetails;
  }

  private async postProviderRequest(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    timeoutMs: number,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const targetHost = integrationTargetHost(url);
    const transactionId =
      typeof body.transactionId === 'string'
        ? body.transactionId
        : typeof body.clientTransactionId === 'string'
          ? body.clientTransactionId
          : undefined;

    logIntegrationEvent(this.logger, {
      provider: 'prn',
      operation: 'generate_reference',
      outcome: 'started',
      referenceId: transactionId,
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
          provider: 'prn',
          operation: 'generate_reference',
          outcome: 'failed',
          referenceId: transactionId,
          targetHost,
          statusCode: response.status,
          durationMs: durationSince(startedAt),
          errorMessage: 'Provider returned non-success status',
        });
        throw new BadGatewayException(
          `PRN provider initiation failed (${response.status})${
            providerMessage ? `: ${providerMessage.slice(0, 180)}` : ''
          }`,
        );
      }

      const responseBody = (await response
        .json()
        .catch(() => ({}))) as PaymentProviderInitiationBody;

      logIntegrationEvent(this.logger, {
        provider: 'prn',
        operation: 'generate_reference',
        outcome: 'succeeded',
        referenceId: transactionId,
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
        provider: 'prn',
        operation: 'generate_reference',
        outcome: 'failed',
        referenceId: transactionId,
        targetHost,
        durationMs: durationSince(startedAt),
        errorCode: error instanceof Error ? error.name : undefined,
        errorMessage: 'Provider request failed',
      });
      throw new BadGatewayException('PRN provider initiation failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private jsonHeaders() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private timeoutMs() {
    return (
      this.configService.get<number>('payments.prnProvider.timeoutMs') ??
      this.configService.get<number>('payments.provider.timeoutMs') ??
      15000
    );
  }

  private getString(path: string) {
    return this.configService.get<string>(path)?.trim() ?? '';
  }

  private buildMockPrnReference(
    session: BulkPaymentSessionEntity,
    prnProvider?: string,
  ) {
    const providerCode =
      prnProvider === 'mobile_money'
        ? 'MM'
        : prnProvider === 'bank'
          ? 'BANK'
          : 'PRN';

    return `PRN-${providerCode}-${session.id
      .replace(/^pay-/, '')
      .replace(/[^a-z0-9]/gi, '')
      .slice(-10)
      .toUpperCase()}`;
  }
}
