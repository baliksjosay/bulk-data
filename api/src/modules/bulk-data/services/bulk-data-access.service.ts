import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { UserRole } from 'src/modules/users/enums/user-role.enum';
import { BulkCustomerEntity } from '../entities';
import {
  BulkAuditEventsRepository,
  BulkBalancesRepository,
  BulkBundlesRepository,
  BulkCustomersRepository,
  BulkServiceRequestsRepository,
  BulkTransactionsRepository,
} from '../repositories';
import { sequenceId } from './bulk-data-query';
import { BulkDataSeedService } from './bulk-data-seed.service';

@Injectable()
export class BulkDataAccessService {
  constructor(
    private readonly seedService: BulkDataSeedService,
    private readonly customers: BulkCustomersRepository,
    private readonly bundles: BulkBundlesRepository,
    private readonly transactions: BulkTransactionsRepository,
    private readonly serviceRequests: BulkServiceRequestsRepository,
    private readonly balances: BulkBalancesRepository,
    private readonly auditEvents: BulkAuditEventsRepository,
  ) {}

  ensureSeedData() {
    return this.seedService.ensureSeedData();
  }

  async requireCustomer(customerId: string) {
    await this.ensureSeedData();
    const customer = await this.customers.findById(customerId);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async requireBundle(bundleId: string) {
    await this.ensureSeedData();
    const bundle = await this.bundles.findById(bundleId);

    if (!bundle) {
      throw new NotFoundException('Package not found');
    }

    return bundle;
  }

  async requireTransaction(transactionId: string) {
    const transaction = await this.transactions.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  async requireServiceRequest(serviceRequestId: string) {
    await this.ensureSeedData();
    const serviceRequest =
      await this.serviceRequests.findById(serviceRequestId);

    if (!serviceRequest) {
      throw new NotFoundException('Service request not found');
    }

    return serviceRequest;
  }

  async resolveActorCustomer(actor: AuthenticatedUser) {
    if (!actor?.email) {
      throw new ForbiddenException(
        'Authenticated customer context is required',
      );
    }
    const customer = await this.customers.findByEmail(actor.email);

    if (customer) {
      return customer;
    }

    const fallback = await this.customers.findById('cus-wavenet');

    if (!fallback) {
      throw new NotFoundException('Customer account not found');
    }

    return fallback;
  }

  assertCanAccessCustomer(
    actor: AuthenticatedUser,
    customer: BulkCustomerEntity,
  ) {
    const roles = actor?.roles ?? [];

    if (
      roles.includes(UserRole.SUPER_ADMIN) ||
      roles.includes(UserRole.ADMIN) ||
      roles.includes(UserRole.SUPPORT)
    ) {
      return;
    }

    if (roles.includes(UserRole.CUSTOMER) && actor.email === customer.email) {
      return;
    }

    throw new ForbiddenException(
      'You do not have access to this customer account',
    );
  }

  assertPrivileged(actor: AuthenticatedUser, roles: UserRole[]) {
    const actorRoles = actor?.roles ?? [];
    const allowed = roles.some((role) => actorRoles.includes(role));

    if (!allowed) {
      throw new ForbiddenException(`Required role(s): ${roles.join(', ')}`);
    }
  }

  assertPrimaryBelongsToCustomer(
    customer: BulkCustomerEntity,
    primaryMsisdn: string,
  ) {
    if (!customer.primaryMsisdns.includes(primaryMsisdn)) {
      throw new NotFoundException('Primary MSISDN not found for this customer');
    }
  }

  async getOrCreateBalance(primaryMsisdn: string) {
    let balance = await this.balances.findByPrimaryMsisdn(primaryMsisdn);

    if (!balance) {
      balance = await this.createZeroBalance(primaryMsisdn);
    }

    return balance;
  }

  createZeroBalance(primaryMsisdn: string) {
    return this.balances.save(
      this.balances.create({
        primaryMsisdn,
        bundleName: 'No active bundle',
        totalVolumeGb: 0,
        remainingVolumeGb: 0,
        expiryAt: new Date(),
        autoTopupRemaining: 0,
      }),
    );
  }

  async audit(
    category: 'security' | 'customer' | 'bundle' | 'integration',
    action: string,
    actor: string,
    outcome: 'success' | 'warning' | 'failed',
  ) {
    await this.auditEvents.save(
      this.auditEvents.create({
        id: sequenceId('aud'),
        category,
        action,
        actor,
        outcome,
      }),
    );
  }
}
