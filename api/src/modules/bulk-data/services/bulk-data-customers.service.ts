import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { WebsocketGateway } from 'src/modules/notifications/services/notification-websocket.service';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { UserStatus } from 'src/modules/users/enums/user-status.enum';
import { UserService } from 'src/modules/users/services/user.service';
import { ActivationService } from 'src/modules/auth/services/core/activation.service';
import {
  CustomerRegistrationDto,
  CustomerStatus,
  CustomerStatusChangeDto,
  CustomerUpdateDto,
  ListQueryDto,
  PrimaryMsisdnDto,
  SecondaryBulkDto,
  SecondaryNumberDto,
} from '../dto/bulk-data.dto';
import { BulkCustomerEntity, BulkSecondaryNumberEntity } from '../entities';
import {
  BulkCustomersRepository,
  BulkSecondaryNumbersRepository,
} from '../repositories';
import { BulkDataAccessService } from './bulk-data-access.service';
import {
  matchesSearch,
  ok,
  okPaginated,
  paginate,
  slugId,
  withinDateRange,
} from './bulk-data-query';
import {
  serializeBalance,
  serializeCustomer,
  serializeSecondary,
} from './bulk-data-serializers';
import { MsisdnValidationResult, nowIso } from './bulk-data.types';
import { BulkDataApnProviderService } from './bulk-data-apn-provider.service';
import { BulkDataProvisioningService } from './bulk-data-provisioning.service';

@Injectable()
export class BulkDataCustomersService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly apnProvider: BulkDataApnProviderService,
    private readonly customers: BulkCustomersRepository,
    private readonly secondaryNumbers: BulkSecondaryNumbersRepository,
    private readonly usersService: UserService,
    private readonly activationService: ActivationService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly provisioningService: BulkDataProvisioningService,
  ) {}

  async listCustomers(query: ListQueryDto) {
    await this.access.ensureSeedData();
    const rows = (await this.customers.findCreatedDesc())
      .filter((customer) =>
        matchesSearch(
          [
            customer.businessName,
            customer.registrationNumber,
            customer.tin,
            customer.businessEmail,
            customer.email,
            customer.apnId,
            customer.status,
            ...customer.primaryMsisdns,
          ],
          query.search,
        ),
      )
      .filter((customer) => !query.status || customer.status === query.status)
      .filter((customer) => withinDateRange(customer.createdAt, query));
    const page = paginate(rows, query);

    return okPaginated(
      page.data.map((customer) => serializeCustomer(customer)),
      page.meta,
      'Customers fetched successfully',
    );
  }

  async registerCustomer(
    actor: AuthenticatedUser,
    dto: CustomerRegistrationDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    await this.access.ensureSeedData();
    const registrationNumber = this.resolveRegistrationNumber(dto);
    const tin = this.normalizeOptional(dto.tin);
    const primaryMsisdn = this.normalizeOptional(dto.primaryMsisdn);
    const existing =
      await this.customers.findByRegistrationNumber(registrationNumber);

    if (existing) {
      throw new ConflictException(
        'Customer registration number already exists',
      );
    }

    if (tin) {
      const existingTin = await this.customers.findByTin(tin);

      if (existingTin) {
        throw new ConflictException('Customer TIN already exists');
      }
    }

    let customer = await this.customers.save(
      this.customers.create({
        id: slugId('cus', dto.businessName),
        businessName: dto.businessName,
        registrationNumber,
        tin,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        contactPerson: dto.contactPerson,
        email: dto.contactEmail,
        phone: dto.contactPhone,
        apnName: dto.apnName,
        apnId: dto.apnId,
        primaryMsisdns: [],
        status: CustomerStatus.PENDING,
      }),
    );
    let validation: MsisdnValidationResult | undefined;

    if (primaryMsisdn) {
      const primaryAttachment = await this.verifyAndAttachPrimaryMsisdn(
        actor,
        customer,
        primaryMsisdn,
      );
      customer = primaryAttachment.customer;
      validation = primaryAttachment.validation;
    }

    const portalUser = await this.usersService.createOrUpdateCustomerPortalUser(
      {
        businessName: customer.businessName,
        contactPerson: customer.contactPerson,
        email: customer.email,
        phoneNumber: customer.phone,
        createdBy: actor.id,
      },
    );
    const activation = await this.activationService.createActivationChallenge(
      portalUser.id,
    );
    await this.access.audit(
      'customer',
      'Customer registered',
      this.auditActor(actor, customer),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'customer',
      action: 'created',
      entityId: customer.id,
      customerId: customer.id,
      status: customer.status,
      message: 'Customer registered',
    });

    if (validation?.accepted) {
      this.websocketGateway.emitDomainEvent({
        entity: 'primary_msisdn',
        action: 'created',
        customerId: customer.id,
        status: 'active',
        message: 'Primary number attached',
      });
    }

    return ok(
      {
        customer: serializeCustomer(customer),
        ...(validation ? { validation } : {}),
        portalUserId: portalUser.id,
        activation: {
          activationToken: activation.token,
          activationUrl: activation.activationUrl,
          expiresAt: activation.expiresAt.toISOString(),
          deliveryChannels: ['contact_email', 'contact_phone'],
        },
      },
      validation && !validation.accepted
        ? `Customer registered. Primary MSISDN was not attached: ${validation.reason}`
        : 'Customer registered successfully',
    );
  }

  async getCustomer(actor: AuthenticatedUser, customerId: string) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    return ok(serializeCustomer(customer), 'Customer fetched successfully');
  }

  async updateCustomer(
    actor: AuthenticatedUser,
    customerId: string,
    dto: CustomerUpdateDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const customer = await this.access.requireCustomer(customerId);
    const previousEmail = customer.email;
    const nextApnId = dto.apnId ?? customer.apnId;
    const tinWasProvided = Object.prototype.hasOwnProperty.call(dto, 'tin');
    const nextTin = tinWasProvided
      ? this.normalizeNullable(dto.tin)
      : customer.tin;

    if (nextTin && nextTin.toLowerCase() !== customer.tin?.toLowerCase()) {
      const existingTin = await this.customers.findByTin(nextTin);

      if (existingTin && existingTin.id !== customer.id) {
        throw new ConflictException('Customer TIN already exists');
      }
    }

    if (nextApnId !== customer.apnId) {
      for (const primaryMsisdn of customer.primaryMsisdns) {
        const validation = await this.apnProvider.validateMsisdnForCustomer(
          primaryMsisdn,
          nextApnId,
          'addSubscriber',
        );

        if (!validation.accepted) {
          throw new UnprocessableEntityException(validation.reason);
        }
      }
    }

    Object.assign(customer, {
      businessName: dto.businessName ?? customer.businessName,
      tin: nextTin,
      businessEmail: dto.businessEmail ?? customer.businessEmail,
      businessPhone: dto.businessPhone ?? customer.businessPhone,
      contactPerson: dto.contactPerson ?? customer.contactPerson,
      email: dto.contactEmail ?? customer.email,
      phone: dto.contactPhone ?? customer.phone,
      apnName: dto.apnName ?? customer.apnName,
      apnId: dto.apnId ?? customer.apnId,
    });
    const saved = await this.customers.save(customer);
    await this.usersService.createOrUpdateCustomerPortalUser({
      businessName: saved.businessName,
      contactPerson: saved.contactPerson,
      email: saved.email,
      phoneNumber: saved.phone,
      createdBy: actor.id,
    });
    await this.deactivatePreviousPortalUser(previousEmail, saved.email);
    await this.access.audit(
      'customer',
      'Customer details updated',
      this.auditActor(actor, saved),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'customer',
      action: 'updated',
      entityId: saved.id,
      customerId: saved.id,
      status: saved.status,
      message: 'Customer details updated',
    });
    return ok(serializeCustomer(saved), 'Customer updated successfully');
  }

  async changeCustomerStatus(
    actor: AuthenticatedUser,
    customerId: string,
    dto: CustomerStatusChangeDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const customer = await this.access.requireCustomer(customerId);
    customer.status = dto.status;
    customer.deactivationReason =
      dto.status === CustomerStatus.DEACTIVATED ? dto.reason : undefined;
    const saved = await this.customers.save(customer);
    await this.syncPortalUserStatus(saved);
    await this.access.audit(
      'customer',
      dto.status === CustomerStatus.ACTIVE
        ? 'Customer reactivated'
        : 'Customer deactivated',
      this.auditActor(actor, saved),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'customer',
      action: 'status_changed',
      entityId: saved.id,
      customerId: saved.id,
      status: saved.status,
      message: 'Customer status updated',
    });
    return ok(serializeCustomer(saved), 'Customer status updated successfully');
  }

  async addPrimaryMsisdn(
    actor: AuthenticatedUser,
    customerId: string,
    dto: PrimaryMsisdnDto,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);

    if (customer.primaryMsisdns.includes(dto.primaryMsisdn)) {
      throw new ConflictException(
        'Primary MSISDN is already registered to this customer',
      );
    }

    await this.ensureMsisdnIsAvailableAsPrimary(dto.primaryMsisdn);

    const validation = await this.apnProvider.validateMsisdnForCustomer(
      dto.primaryMsisdn,
      customer.apnId,
      'addSubscriber',
    );

    if (!validation.accepted) {
      throw new UnprocessableEntityException(validation.reason);
    }

    customer.primaryMsisdns = [...customer.primaryMsisdns, dto.primaryMsisdn];
    const saved = await this.customers.save(customer);
    await this.access.createZeroBalance(dto.primaryMsisdn);
    await this.access.audit(
      'customer',
      'Primary MSISDN added',
      this.auditActor(actor, saved),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'primary_msisdn',
      action: 'created',
      customerId: saved.id,
      status: 'active',
      message: 'Primary number added',
    });

    return ok(
      {
        customer: serializeCustomer(saved),
        validation,
      },
      'Primary MSISDN added successfully',
    );
  }

  async getBalance(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const balance = await this.access.getOrCreateBalance(primaryMsisdn);
    return ok(serializeBalance(balance), 'Bundle balance fetched successfully');
  }

  async listSecondaryNumbers(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    query: ListQueryDto,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const rows = (
      await this.secondaryNumbers.findByCustomerAndPrimary(
        customerId,
        primaryMsisdn,
      )
    )
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => withinDateRange(row.addedAt, query))
      .filter((row) =>
        matchesSearch([row.msisdn, row.apnId, row.status], query.search),
      );
    const page = paginate(rows, query);

    return okPaginated(
      page.data.map((row) => serializeSecondary(row)),
      page.meta,
      'Secondary numbers fetched successfully',
    );
  }

  async addSecondaryNumber(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    dto: SecondaryNumberDto,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    await this.ensureMsisdnIsNotPrimary(dto.msisdn);
    const existing = await this.secondaryNumbers.findActiveByMsisdn(dto.msisdn);
    const validation = await this.getSecondaryValidation(
      customer,
      dto.msisdn,
      existing,
      'addGroupMember',
    );

    if (!validation.accepted) {
      throw new UnprocessableEntityException(validation.reason);
    }

    const secondaryNumber = await this.secondaryNumbers.save(
      this.secondaryNumbers.create({
        id: slugId('sec', dto.msisdn),
        customerId,
        primaryMsisdn,
        msisdn: dto.msisdn,
        apnId: customer.apnId,
        status: 'active',
        addedAt: new Date(),
      }),
    );
    customer.secondaryCount += 1;
    await this.customers.save(customer);
    await this.access.audit(
      'customer',
      'Secondary MSISDN added',
      this.auditActor(actor, customer),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'secondary_msisdn',
      action: 'created',
      entityId: secondaryNumber.id,
      customerId: customer.id,
      status: secondaryNumber.status,
      message: 'Secondary number added',
    });

    return ok(
      {
        secondaryNumber: serializeSecondary(secondaryNumber),
        validation,
      },
      'Secondary MSISDN added successfully',
    );
  }

  async addSecondaryNumbersBulk(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    dto: SecondaryBulkDto,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const added: Record<string, unknown>[] = [];
    const rejected: MsisdnValidationResult[] = [];

    for (const msisdn of dto.msisdns) {
      const primaryOwner = await this.findPrimaryOwner(msisdn);

      if (primaryOwner) {
        rejected.push({
          msisdn,
          accepted: false,
          reason: 'MSISDN is already registered as a primary number',
          apnIds: [primaryOwner.apnId],
          registeredApnId: primaryOwner.apnId,
        });
        continue;
      }

      const existing = await this.secondaryNumbers.findActiveByMsisdn(msisdn);
      const validation = await this.getSecondaryValidation(
        customer,
        msisdn,
        existing,
        'addMultipleGroupMember',
      );

      if (!validation.accepted) {
        rejected.push(validation);
        continue;
      }

      const secondaryNumber = await this.secondaryNumbers.save(
        this.secondaryNumbers.create({
          id: slugId('sec', msisdn),
          customerId,
          primaryMsisdn,
          msisdn,
          apnId: customer.apnId,
          status: 'active',
          addedAt: new Date(),
        }),
      );
      added.push(serializeSecondary(secondaryNumber));
    }

    if (added.length > 0) {
      customer.secondaryCount += added.length;
      await this.customers.save(customer);
    }
    await this.access.audit(
      'customer',
      'Bulk secondary MSISDN upload processed',
      this.auditActor(actor, customer),
      rejected.length > 0 ? 'warning' : 'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'secondary_msisdn',
      action: 'created',
      customerId: customer.id,
      message: 'Bulk secondary number upload processed',
      metadata: {
        added: added.length,
        rejected: rejected.length,
      },
    });

    return ok({ added, rejected }, 'Bulk secondary MSISDN upload processed');
  }

  async removeSecondaryNumber(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const secondaryNumber = await this.secondaryNumbers.findActiveMember(
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );

    if (!secondaryNumber) {
      throw new NotFoundException('Secondary MSISDN not found');
    }

    try {
      await this.provisioningService.removeSecondaryGroupMember(
        actor,
        secondaryNumber.msisdn,
      );
    } catch (error) {
      await this.access.audit(
        'integration',
        'Secondary MSISDN group removal failed',
        this.auditActor(actor, customer),
        'failed',
      );
      throw error;
    }

    secondaryNumber.status = 'removed';
    const saved = await this.secondaryNumbers.save(secondaryNumber);
    customer.secondaryCount = Math.max(customer.secondaryCount - 1, 0);
    await this.customers.save(customer);
    await this.access.audit(
      'customer',
      'Secondary MSISDN removed',
      this.auditActor(actor, customer),
      'success',
    );
    this.websocketGateway.emitDomainEvent({
      entity: 'secondary_msisdn',
      action: 'removed',
      entityId: saved.id,
      customerId: customer.id,
      status: saved.status,
      message: 'Secondary number removed',
    });
    return ok(
      serializeSecondary(saved),
      'Secondary MSISDN removed successfully',
    );
  }

  async getSecondaryUsage(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) {
    const customer = await this.access.requireCustomer(customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const secondaryNumber = await this.secondaryNumbers.findActiveMember(
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );

    if (!secondaryNumber) {
      throw new NotFoundException('Secondary MSISDN not found');
    }

    const activeMembers = await this.secondaryNumbers.countActiveMembers(
      customerId,
      primaryMsisdn,
    );
    const balance = await this.access.getOrCreateBalance(primaryMsisdn);
    const allocatedVolumeGb =
      activeMembers > 0 ? Number(balance.totalVolumeGb) / activeMembers : 0;
    const usagePercent = allocatedVolumeGb > 0 ? 42 : 0;
    const usedVolumeGb = Number(
      ((allocatedVolumeGb * usagePercent) / 100).toFixed(2),
    );

    return ok(
      {
        customerId,
        primaryMsisdn,
        secondaryMsisdn,
        bundleName: balance.bundleName,
        allocatedVolumeGb: Number(allocatedVolumeGb.toFixed(2)),
        usedVolumeGb,
        remainingVolumeGb: Number(
          (allocatedVolumeGb - usedVolumeGb).toFixed(2),
        ),
        usagePercent,
        lastUsedAt: nowIso(),
        status: secondaryNumber.status,
      },
      'Secondary MSISDN usage fetched successfully',
    );
  }

  private async getSecondaryValidation(
    customer: BulkCustomerEntity,
    msisdn: string,
    existing: BulkSecondaryNumberEntity | null,
    action: MsisdnValidationResult['provisioningAction'],
  ) {
    return existing
      ? {
          msisdn,
          accepted: false,
          reason: 'MSISDN is already part of a secondary number family',
          apnIds: [customer.apnId],
          registeredApnId: customer.apnId,
        }
      : this.apnProvider.validateMsisdnForCustomer(
          msisdn,
          customer.apnId,
          action,
        );
  }

  private async verifyAndAttachPrimaryMsisdn(
    actor: AuthenticatedUser,
    customer: BulkCustomerEntity,
    primaryMsisdn: string,
  ): Promise<{
    customer: BulkCustomerEntity;
    validation: MsisdnValidationResult;
  }> {
    const primaryOwner = await this.findPrimaryOwner(primaryMsisdn);

    if (primaryOwner) {
      return {
        customer,
        validation: this.rejectedPrimaryValidation(
          primaryMsisdn,
          'MSISDN is already registered as a primary number',
          primaryOwner.apnId,
        ),
      };
    }

    const secondaryOwner =
      await this.secondaryNumbers.findActiveByMsisdn(primaryMsisdn);

    if (secondaryOwner) {
      return {
        customer,
        validation: this.rejectedPrimaryValidation(
          primaryMsisdn,
          'MSISDN is already registered as a secondary number',
          secondaryOwner.apnId,
        ),
      };
    }

    const validation = await this.apnProvider.validateMsisdnForCustomer(
      primaryMsisdn,
      customer.apnId,
      'addSubscriber',
    );

    if (!validation.accepted) {
      return { customer, validation };
    }

    customer.primaryMsisdns = [...customer.primaryMsisdns, primaryMsisdn];
    const saved = await this.customers.save(customer);
    await this.access.createZeroBalance(primaryMsisdn);
    await this.access.audit(
      'customer',
      'Primary MSISDN verified and added',
      this.auditActor(actor, saved),
      'success',
    );

    return { customer: saved, validation };
  }

  private rejectedPrimaryValidation(
    msisdn: string,
    reason: string,
    registeredApnId: string,
  ): MsisdnValidationResult {
    return {
      msisdn,
      accepted: false,
      reason,
      apnIds: [registeredApnId],
      registeredApnId,
      provisioningAction: 'addSubscriber',
    };
  }

  private resolveRegistrationNumber(dto: CustomerRegistrationDto): string {
    const providedReference =
      this.normalizeOptional(dto.registrationNumber) ??
      this.normalizeOptional(dto.tin);

    return (
      providedReference ?? `CUST-${randomUUID().slice(0, 8).toUpperCase()}`
    );
  }

  private normalizeOptional(value?: string): string | undefined {
    const trimmed = value?.trim();

    return trimmed || undefined;
  }

  private normalizeNullable(value?: string): string | null {
    const trimmed = value?.trim();

    return trimmed || null;
  }

  private async ensureMsisdnIsAvailableAsPrimary(msisdn: string) {
    await this.ensureMsisdnIsNotPrimary(msisdn);

    const secondaryOwner =
      await this.secondaryNumbers.findActiveByMsisdn(msisdn);
    if (secondaryOwner) {
      throw new ConflictException(
        'MSISDN is already registered as a secondary number',
      );
    }
  }

  private async ensureMsisdnIsNotPrimary(msisdn: string) {
    const primaryOwner = await this.findPrimaryOwner(msisdn);

    if (primaryOwner) {
      throw new ConflictException(
        'MSISDN is already registered as a primary number',
      );
    }
  }

  private async findPrimaryOwner(msisdn: string) {
    const customers = await this.customers.findCreatedDesc();

    return (
      customers.find((customer) => customer.primaryMsisdns.includes(msisdn)) ??
      null
    );
  }

  private auditActor(actor: AuthenticatedUser, customer: BulkCustomerEntity) {
    const roles = actor.roles?.join(',') || 'unknown';
    return `${actor.email} [${roles}] -> ${customer.businessName}`;
  }

  private async syncPortalUserStatus(customer: BulkCustomerEntity) {
    const user = await this.usersService.findByEmail(customer.email);

    if (!user?.roles.includes(UserRole.CUSTOMER)) {
      return;
    }

    await this.usersService.changeStatus(
      user.id,
      customer.status === CustomerStatus.ACTIVE
        ? UserStatus.ACTIVE
        : UserStatus.INACTIVE,
    );
  }

  private async deactivatePreviousPortalUser(
    previousEmail: string,
    nextEmail: string,
  ) {
    if (previousEmail.trim().toLowerCase() === nextEmail.trim().toLowerCase()) {
      return;
    }

    const user = await this.usersService.findByEmail(previousEmail);

    if (!user?.roles.includes(UserRole.CUSTOMER)) {
      return;
    }

    await this.usersService.changeStatus(user.id, UserStatus.INACTIVE);
  }
}
