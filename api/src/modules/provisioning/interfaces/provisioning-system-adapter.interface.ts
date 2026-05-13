import { AddGroupMemberDto } from '../dto/add-group-member.dto';
import { AddGroupMembersBulkDto } from '../dto/add-group-members-bulk.dto';
import { AddSubscriberDto } from '../dto/add-subscriber.dto';
import { DeleteGroupMemberDto } from '../dto/delete-group-member.dto';
import { SubscribeServiceDto } from '../dto/subscribe-service.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

export const PROVISIONING_SYSTEM_ADAPTER = Symbol(
  'PROVISIONING_SYSTEM_ADAPTER',
);

export interface ProvisioningProviderResult {
  statusCode: number;
  accepted?: boolean;
  body: Record<string, unknown> | null;
}

export interface ProvisioningSystemAdapter {
  addGroupMember(
    payload: AddGroupMemberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
  addGroupMembersBulk(
    payload: AddGroupMembersBulkDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
  deleteGroupMember(
    payload: DeleteGroupMemberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
  updateSubscription(
    payload: UpdateSubscriptionDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
  addSubscriber(
    payload: AddSubscriberDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
  subscribeService(
    payload: SubscribeServiceDto,
    requestId: string,
  ): Promise<ProvisioningProviderResult>;
}
