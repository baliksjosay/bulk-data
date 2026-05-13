import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { AddGroupMemberDto } from '../dto/add-group-member.dto';
import { AddGroupMembersBulkDto } from '../dto/add-group-members-bulk.dto';
import { AddSubscriberDto } from '../dto/add-subscriber.dto';
import {
  AddGroupMemberResponseDto,
  AddGroupMembersBulkResponseDto,
  AddSubscriberResponseDto,
  DeleteGroupMemberResponseDto,
  SubscribeServiceResponseDto,
  UpdateSubscriptionResponseDto,
} from '../dto/provisioning-command-response.dto';
import { DeleteGroupMemberDto } from '../dto/delete-group-member.dto';
import { SubscribeServiceDto } from '../dto/subscribe-service.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { ProvisioningOperation } from '../enums/provisioning-operation.enum';
import {
  PROVISIONING_SYSTEM_ADAPTER,
  ProvisioningProviderResult,
  ProvisioningSystemAdapter,
} from '../interfaces/provisioning-system-adapter.interface';
import { maskProvisioningMsisdn } from '../utils/provisioning-msisdn.util';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @Inject(PROVISIONING_SYSTEM_ADAPTER)
    private readonly provisioningAdapter: ProvisioningSystemAdapter,
  ) {}

  async addGroupMember(
    actor: AuthenticatedUser,
    dto: AddGroupMemberDto,
  ): Promise<AddGroupMemberResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] add_group_member actor=${actor.id} primary=${maskProvisioningMsisdn(dto.primaryMsisdn)} secondary=${maskProvisioningMsisdn(dto.secondaryMsisdn)}`,
    );
    const providerResult = await this.provisioningAdapter.addGroupMember(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.ADD_GROUP_MEMBER,
      dto,
      providerResult,
    );
  }

  async addGroupMembersBulk(
    actor: AuthenticatedUser,
    dto: AddGroupMembersBulkDto,
  ): Promise<AddGroupMembersBulkResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] add_group_members_bulk actor=${actor.id} count=${dto.groupMembers.length}`,
    );
    const providerResult = await this.provisioningAdapter.addGroupMembersBulk(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.ADD_GROUP_MEMBERS_BULK,
      dto,
      providerResult,
    );
  }

  async deleteGroupMember(
    actor: AuthenticatedUser,
    dto: DeleteGroupMemberDto,
  ): Promise<DeleteGroupMemberResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] delete_group_member actor=${actor.id} secondary=${maskProvisioningMsisdn(dto.secondaryMsisdn)}`,
    );
    const providerResult = await this.provisioningAdapter.deleteGroupMember(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.DELETE_GROUP_MEMBER,
      dto,
      providerResult,
    );
  }

  async updateSubscription(
    actor: AuthenticatedUser,
    dto: UpdateSubscriptionDto,
  ): Promise<UpdateSubscriptionResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] update_subscription actor=${actor.id} primary=${maskProvisioningMsisdn(dto.primaryMsisdn)} transaction=${dto.transactionId}`,
    );
    const providerResult = await this.provisioningAdapter.updateSubscription(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.UPDATE_SUBSCRIPTION,
      dto,
      providerResult,
    );
  }

  async addSubscriber(
    actor: AuthenticatedUser,
    dto: AddSubscriberDto,
  ): Promise<AddSubscriberResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] add_subscriber actor=${actor.id} msisdn=${maskProvisioningMsisdn(dto.msisdn)} transaction=${dto.transactionId}`,
    );
    const providerResult = await this.provisioningAdapter.addSubscriber(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.ADD_SUBSCRIBER,
      dto,
      providerResult,
    );
  }

  async subscribeService(
    actor: AuthenticatedUser,
    dto: SubscribeServiceDto,
  ): Promise<SubscribeServiceResponseDto> {
    const requestId = randomUUID();
    this.logger.log(
      `[${requestId}] subscribe_service actor=${actor.id} msisdn=${maskProvisioningMsisdn(dto.msisdn)} transaction=${dto.transactionId}`,
    );
    const providerResult = await this.provisioningAdapter.subscribeService(
      dto,
      requestId,
    );

    return this.buildResponse(
      requestId,
      ProvisioningOperation.SUBSCRIBE_SERVICE,
      dto,
      providerResult,
    );
  }

  private buildResponse<TRequest>(
    requestId: string,
    operation: ProvisioningOperation,
    request: TRequest,
    providerResult: ProvisioningProviderResult,
  ) {
    return {
      requestId,
      operation,
      accepted:
        providerResult.accepted ??
        (providerResult.statusCode >= 200 && providerResult.statusCode < 300),
      processedAt: new Date().toISOString(),
      providerStatusCode: providerResult.statusCode,
      request,
      providerResponse: providerResult.body,
    };
  }
}
