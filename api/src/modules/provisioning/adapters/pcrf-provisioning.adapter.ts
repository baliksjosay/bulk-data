import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  durationSince,
  integrationTargetHost,
  logIntegrationEvent,
} from 'src/common/logging/integration-logger';
import { AddGroupMemberDto } from '../dto/add-group-member.dto';
import { AddGroupMembersBulkDto } from '../dto/add-group-members-bulk.dto';
import { AddSubscriberDto } from '../dto/add-subscriber.dto';
import { DeleteGroupMemberDto } from '../dto/delete-group-member.dto';
import { SubscribeServiceDto } from '../dto/subscribe-service.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import {
  ProvisioningProviderResult,
  ProvisioningSystemAdapter,
} from '../interfaces/provisioning-system-adapter.interface';
import { normalizeProviderResponseBody } from '../utils/provisioning-msisdn.util';

type PcrfEndpointKey =
  | 'groupMember'
  | 'groupMembersBulk'
  | 'groupMemberDelete'
  | 'subscriptionUpdate'
  | 'subscriber'
  | 'subscribeService';

@Injectable()
export class PcrfProvisioningAdapter implements ProvisioningSystemAdapter {
  private readonly logger = new Logger(PcrfProvisioningAdapter.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  addGroupMember(
    payload: AddGroupMemberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('groupMember', { ...payload }, requestId);
  }

  addGroupMembersBulk(
    payload: AddGroupMembersBulkDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('groupMembersBulk', { ...payload }, requestId);
  }

  deleteGroupMember(
    payload: DeleteGroupMemberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('groupMemberDelete', { ...payload }, requestId);
  }

  updateSubscription(
    payload: UpdateSubscriptionDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('subscriptionUpdate', { ...payload }, requestId);
  }

  addSubscriber(
    payload: AddSubscriberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('subscriber', { ...payload }, requestId);
  }

  subscribeService(
    payload: SubscribeServiceDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    return this.post('subscribeService', { ...payload }, requestId);
  }

  private async post(
    endpoint: PcrfEndpointKey,
    payload: Record<string, unknown>,
    requestId: string,
  ): Promise<ProvisioningProviderResult> {
    const targetUrl = this.getEndpointTargetUrl(endpoint);
    const timeout =
      this.configService.get<number>('provisioning.pcrf.timeoutMs') ?? 15000;
    const startedAt = Date.now();
    const targetHost = integrationTargetHost(targetUrl);

    logIntegrationEvent(this.logger, {
      provider: 'pcrf',
      operation: endpoint,
      outcome: 'started',
      requestId,
      targetHost,
      context: { timeoutMs: timeout },
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post(targetUrl, payload, {
          headers: this.buildHeaders(requestId),
          timeout,
        }),
      );
      const body = normalizeProviderResponseBody(response.data);
      const accepted = this.isPcrfSuccess(body);

      if (!accepted) {
        logIntegrationEvent(this.logger, {
          provider: 'pcrf',
          operation: endpoint,
          outcome: 'failed',
          requestId,
          targetHost,
          statusCode: response.status,
          durationMs: durationSince(startedAt),
          errorMessage: 'Provider rejected request',
        });
        this.logger.warn(
          `[${requestId}] PCRF rejected ${endpoint}: ${this.buildPcrfFailureReason(body)}`,
        );
        throw new BadGatewayException(
          'Provisioning upstream rejected the request',
        );
      }

      logIntegrationEvent(this.logger, {
        provider: 'pcrf',
        operation: endpoint,
        outcome: 'succeeded',
        requestId,
        targetHost,
        statusCode: response.status,
        durationMs: durationSince(startedAt),
      });

      return {
        statusCode: response.status,
        accepted,
        body,
      };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof GatewayTimeoutException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const providerStatus = error.response?.status;

        if (error.code === 'ECONNABORTED') {
          logIntegrationEvent(this.logger, {
            provider: 'pcrf',
            operation: endpoint,
            outcome: 'failed',
            requestId,
            targetHost,
            durationMs: durationSince(startedAt),
            errorCode: error.code,
            errorMessage: 'Provider request timed out',
          });
          throw new GatewayTimeoutException(
            'Provisioning upstream request timed out',
          );
        }

        if (providerStatus) {
          logIntegrationEvent(this.logger, {
            provider: 'pcrf',
            operation: endpoint,
            outcome: 'failed',
            requestId,
            targetHost,
            statusCode: providerStatus,
            durationMs: durationSince(startedAt),
            errorCode: error.code,
            errorMessage: 'Provider returned non-success status',
          });
          this.logger.warn(
            `[${requestId}] provisioning upstream rejected request with status ${providerStatus}`,
          );
          throw new BadGatewayException(
            'Provisioning upstream rejected the request',
          );
        }
      }

      logIntegrationEvent(this.logger, {
        provider: 'pcrf',
        operation: endpoint,
        outcome: 'failed',
        requestId,
        targetHost,
        durationMs: durationSince(startedAt),
        errorMessage: 'Provider unavailable',
      });
      this.logger.error(`[${requestId}] provisioning upstream is unavailable`);
      throw new ServiceUnavailableException(
        'Provisioning upstream is unavailable',
      );
    }
  }

  private getEndpointPath(endpoint: PcrfEndpointKey): string {
    const configuredPath = this.configService.get<string>(
      `provisioning.pcrf.paths.${endpoint}`,
    );

    if (!configuredPath) {
      throw new ServiceUnavailableException(
        `Provisioning path is not configured for ${endpoint}`,
      );
    }

    return configuredPath;
  }

  private getEndpointTargetUrl(endpoint: PcrfEndpointKey): string {
    const baseUrl = this.configService.get<string>('provisioning.pcrf.baseUrl');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'Provisioning integration is not configured',
      );
    }

    return this.buildTargetUrl(baseUrl, this.getEndpointPath(endpoint));
  }

  private buildTargetUrl(baseUrl: string, path: string): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = path.replace(/^\/+/, '');
    return new URL(normalizedPath, normalizedBase).toString();
  }

  private buildHeaders(requestId: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    };

    return headers;
  }

  private isPcrfSuccess(body: Record<string, unknown> | null) {
    if (!body) {
      return true;
    }

    const successful = body.successful;
    const resultCode = body.resultCode;
    const statusCode = body.statusCode;

    if (
      successful !== undefined &&
      successful !== true &&
      String(successful).toLowerCase() !== 'true'
    ) {
      return false;
    }

    if (resultCode !== undefined && String(resultCode) !== '0') {
      return false;
    }

    if (statusCode !== undefined && Number(statusCode) !== 200) {
      return false;
    }

    return true;
  }

  private buildPcrfFailureReason(body: Record<string, unknown> | null) {
    if (!body) {
      return 'empty response body';
    }

    const resultCode = body.resultCode ?? 'unknown';
    const statusCode = body.statusCode ?? 'unknown';
    const message = body.message ?? 'No provider message';

    return `statusCode=${String(statusCode)} resultCode=${String(resultCode)} message=${String(message)}`;
  }
}
