import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      this.prnHeaders(),
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
          `PRN provider initiation failed (${response.status})${
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

      throw new BadGatewayException('PRN provider initiation failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private prnHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const bearerToken =
      this.getString('payments.prnProvider.bearerToken') ||
      this.getString('payments.provider.bearerToken');
    const apiKey =
      this.getString('payments.prnProvider.apiKey') ||
      this.getString('payments.provider.apiKey');

    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
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
