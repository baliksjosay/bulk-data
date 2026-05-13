import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as https from 'node:https';
import { normalizeProvisioningMsisdn } from 'src/modules/provisioning/utils/provisioning-msisdn.util';
import { MsisdnValidationResult } from './bulk-data.types';

type ApnProviderBody = Record<string, unknown> | null;

@Injectable()
export class BulkDataApnProviderService {
  constructor(private readonly configService: ConfigService) {}

  async validateMsisdnForCustomer(
    msisdn: string,
    registeredApnId: string,
    provisioningAction: MsisdnValidationResult['provisioningAction'],
  ): Promise<MsisdnValidationResult> {
    const normalizedMsisdn = normalizeProvisioningMsisdn(msisdn);
    const apnIds = await this.retrieveApnIds(normalizedMsisdn);

    if (apnIds.length > 1) {
      return {
        msisdn,
        accepted: false,
        reason: 'MSISDN has more than one APN attached',
        apnIds,
        registeredApnId,
      };
    }

    if (apnIds.length === 0) {
      return {
        msisdn,
        accepted: false,
        reason: 'MSISDN APN could not be verified',
        apnIds,
        registeredApnId,
      };
    }

    if (!apnMatches(apnIds[0], registeredApnId)) {
      return {
        msisdn,
        accepted: false,
        reason: 'MSISDN APN differs from the registered customer APN',
        apnIds,
        registeredApnId,
      };
    }

    return {
      msisdn,
      accepted: true,
      reason: 'MSISDN APN validation passed',
      apnIds,
      registeredApnId,
      provisioningAction,
    };
  }

  private async retrieveApnIds(msisdn: string) {
    const url = this.configService.get<string>('apnProvider.url')?.trim();

    if (!url) {
      throw new ServiceUnavailableException('APN validation is not configured');
    }

    try {
      const response = await axios.post<ApnProviderBody>(
        url,
        { msisdn },
        {
          headers: this.buildHeaders(),
          httpsAgent: this.buildHttpsAgent(),
          timeout:
            this.configService.get<number>('apnProvider.timeoutMs') ?? 15000,
        },
      );
      return uniqueStrings(extractApnIds(response.data));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new GatewayTimeoutException(
            'APN validation provider request timed out',
          );
        }

        if (error.response?.status) {
          throw new BadGatewayException(
            'APN validation provider rejected the request',
          );
        }
      }

      throw new ServiceUnavailableException(
        'APN validation provider is unavailable',
      );
    }
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const partnerId = this.configService.get<string>('apnProvider.partnerId');
    const apiKey = this.configService.get<string>('apnProvider.apiKey');

    if (partnerId) {
      headers['partner-id'] = partnerId;
    }

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    return headers;
  }

  private buildHttpsAgent() {
    const rejectUnauthorized =
      this.configService.get<boolean>('apnProvider.tlsRejectUnauthorized') ??
      true;

    return new https.Agent({ rejectUnauthorized });
  }
}

function extractApnIds(value: unknown, insideApnContainer = false): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value).trim()].filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractApnIds(item, insideApnContainer));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const body = value as Record<string, unknown>;
  const apnValueKeys = new Set(['apnid', 'apnidentifier', 'apnidentifierid']);
  const apnContainerKeys = new Set([
    'apn',
    'apns',
    'apnid',
    'apnids',
    'apnlist',
    'data',
    'result',
    'response',
    'items',
    'records',
  ]);

  return Object.entries(body).flatMap(([key, item]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();

    if (
      apnValueKeys.has(normalizedKey) ||
      (insideApnContainer && normalizedKey === 'id')
    ) {
      return extractApnIds(item);
    }

    if (apnContainerKeys.has(normalizedKey)) {
      return extractApnIds(item, true);
    }

    return [];
  });
}

function apnMatches(actualApnId: string, registeredApnId: string) {
  return normalizeApnId(actualApnId) === normalizeApnId(registeredApnId);
}

function normalizeApnId(value: string) {
  return value.trim().toLowerCase();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
