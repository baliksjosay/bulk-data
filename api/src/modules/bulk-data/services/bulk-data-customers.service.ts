import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
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

@Injectable()
export class BulkDataCustomersService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly apnProvider: BulkDataApnProviderService,
    private readonly customers: BulkCustomersRepository,
    private readonly secondaryNumbers: BulkSecondaryNumbersRepository,
  ) {}

  async listCustomers(query: ListQueryDto) {
    await this.access.ensureSeedData();
    const rows = (await this.customers.findCreatedDesc())
      .filter((customer) =>
        matchesSearch(
          [
            customer.businessName,
            customer.registrationNumber,
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
    const existing = await this.customers.findByRegistrationNumber(
      dto.registrationNumber,
    );

    if (existing) {
      throw new ConflictException(
        'Customer registration number already exists',
      );
    }

    const validation = await this.apnProvider.validateMsisdnForCustomer(
      dto.primaryMsisdn,
      dto.apnId,
      'addSubscriber',
    );

    if (!validation.accepted) {
      throw new UnprocessableEntityException(validation.reason);
    }

    const customer = await this.customers.save(
      this.customers.create({
        id: slugId('cus', dto.businessName),
        businessName: dto.businessName,
        registrationNumber: dto.registrationNumber,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        contactPerson: dto.contactPerson,
        email: dto.contactEmail,
        phone: dto.contactPhone,
        apnName: dto.apnName,
        apnId: dto.apnId,
        primaryMsisdns: [dto.primaryMsisdn],
        status: CustomerStatus.PENDING,
      }),
    );
    await this.access.createZeroBalance(dto.primaryMsisdn);
    await this.access.audit(
      'customer',
      'Customer registered',
      customer.businessName,
      'success',
    );

    return ok(
      {
        customer: serializeCustomer(customer),
        validation,
      },
      'Customer registered successfully',
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
    Object.assign(customer, {
      businessName: dto.businessName ?? customer.businessName,
      businessEmail: dto.businessEmail ?? customer.businessEmail,
      businessPhone: dto.businessPhone ?? customer.businessPhone,
      contactPerson: dto.contactPerson ?? customer.contactPerson,
      email: dto.contactEmail ?? customer.email,
      phone: dto.contactPhone ?? customer.phone,
      apnName: dto.apnName ?? customer.apnName,
      apnId: dto.apnId ?? customer.apnId,
    });
    const saved = await this.customers.save(customer);
    await this.access.audit(
      'customer',
      'Customer details updated',
      saved.businessName,
      'success',
    );
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
    await this.access.audit(
      'customer',
      dto.status === CustomerStatus.ACTIVE
        ? 'Customer reactivated'
        : 'Customer deactivated',
      saved.businessName,
      'success',
    );
    return ok(serializeCustomer(saved), 'Customer status updated successfully');
  }

  async addPrimaryMsisdn(
    actor: AuthenticatedUser,
    customerId: string,
    dto: PrimaryMsisdnDto,
  ) {
    this.access.assertPrivileged(actor, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
    const customer = await this.access.requireCustomer(customerId);

    if (customer.primaryMsisdns.includes(dto.primaryMsisdn)) {
      throw new ConflictException(
        'Primary MSISDN is already registered to this customer',
      );
    }

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
      saved.businessName,
      'success',
    );

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
      customer.businessName,
      'success',
    );

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
      customer.businessName,
      rejected.length > 0 ? 'warning' : 'success',
    );

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

    secondaryNumber.status = 'removed';
    const saved = await this.secondaryNumbers.save(secondaryNumber);
    customer.secondaryCount = Math.max(customer.secondaryCount - 1, 0);
    await this.customers.save(customer);
    await this.access.audit(
      'customer',
      'Secondary MSISDN removed',
      customer.businessName,
      'success',
    );
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
}
