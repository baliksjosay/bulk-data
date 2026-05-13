import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { AddGroupMemberDto } from '../dto/add-group-member.dto';
import { AddGroupMembersBulkDto } from '../dto/add-group-members-bulk.dto';
import { AddSubscriberDto } from '../dto/add-subscriber.dto';
import {
  AddGroupMemberResponseDto,
  AddGroupMembersBulkResponseDto,
  AddSubscriberResponseDto,
  DeleteGroupMemberResponseDto,
  UpdateSubscriptionResponseDto,
} from '../dto/provisioning-command-response.dto';
import { DeleteGroupMemberDto } from '../dto/delete-group-member.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { ProvisioningService } from '../services/provisioning.service';

@ApiTags('Provisioning')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post('group-member')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Add a provisioning group member',
    description:
      'Adds a secondary MSISDN under a primary subscription through the configured provisioning adapter. This endpoint is privileged because it changes live network entitlement state.',
  })
  @ApiOkResponse({
    description: 'Provisioning group-member request accepted.',
    type: AddGroupMemberResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiBadGatewayResponse({
    description: 'The upstream provisioning provider rejected the request.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provisioning integration is unavailable or not configured.',
  })
  addGroupMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AddGroupMemberDto,
  ): Promise<AddGroupMemberResponseDto> {
    return this.provisioningService.addGroupMember(actor, dto);
  }

  @Post('group-members/bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Bulk add provisioning group members',
    description:
      'Adds multiple secondary MSISDNs through the configured provisioning adapter in a single upstream request.',
  })
  @ApiOkResponse({
    description: 'Provisioning bulk group-member request accepted.',
    type: AddGroupMembersBulkResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiBadGatewayResponse({
    description: 'The upstream provisioning provider rejected the request.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provisioning integration is unavailable or not configured.',
  })
  addGroupMembersBulk(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AddGroupMembersBulkDto,
  ): Promise<AddGroupMembersBulkResponseDto> {
    return this.provisioningService.addGroupMembersBulk(actor, dto);
  }

  @Post('group-member/delete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Delete a provisioning group member',
    description:
      'Removes a secondary MSISDN from the group subscription through the configured provisioning adapter.',
  })
  @ApiOkResponse({
    description: 'Provisioning delete group-member request accepted.',
    type: DeleteGroupMemberResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiBadGatewayResponse({
    description: 'The upstream provisioning provider rejected the request.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provisioning integration is unavailable or not configured.',
  })
  deleteGroupMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: DeleteGroupMemberDto,
  ): Promise<DeleteGroupMemberResponseDto> {
    return this.provisioningService.deleteGroupMember(actor, dto);
  }

  @Post('subscriptions/update')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Update subscription provisioning',
    description:
      'Submits a repeated subscription top-up/update command through the configured provisioning adapter after payment and bundle selection logic are complete.',
  })
  @ApiOkResponse({
    description: 'Provisioning subscription update request accepted.',
    type: UpdateSubscriptionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiBadGatewayResponse({
    description: 'The upstream provisioning provider rejected the request.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provisioning integration is unavailable or not configured.',
  })
  updateSubscription(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<UpdateSubscriptionResponseDto> {
    return this.provisioningService.updateSubscription(actor, dto);
  }

  @Post('subscriber')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary: 'Add a subscriber through provisioning',
    description:
      'Adds a primary subscriber through the configured provisioning adapter. Provider-specific request enrichment is isolated inside the adapter and is not part of the public contract.',
  })
  @ApiOkResponse({
    description: 'Provisioning add-subscriber request accepted.',
    type: AddSubscriberResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiBadGatewayResponse({
    description: 'The upstream provisioning provider rejected the request.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provisioning integration is unavailable or not configured.',
  })
  addSubscriber(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AddSubscriberDto,
  ): Promise<AddSubscriberResponseDto> {
    return this.provisioningService.addSubscriber(actor, dto);
  }
}
