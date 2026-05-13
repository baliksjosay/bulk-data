import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import {
  CustomerStatus,
  ListQueryDto,
  OverviewQueryDto,
  PaymentMethod,
  ReportTransactionQueryDto,
  TransactionStatus,
} from '../dto/bulk-data.dto';
import { BulkTransactionEntity } from '../entities';
import {
  BulkAuditEventsRepository,
  BulkBalancesRepository,
  BulkBundlesRepository,
  BulkCustomersRepository,
  BulkSecondaryNumbersRepository,
  BulkTransactionsRepository,
} from '../repositories';
import { BulkDataAccessService } from './bulk-data-access.service';
import {
  matchesSearch,
  ok,
  okPaginated,
  paginate,
  withinDateRange,
} from './bulk-data-query';
import {
  serializeBalance,
  serializeBundle,
  serializeCustomer,
  serializeSecondary,
  serializeTransaction,
} from './bulk-data-serializers';
import { nowIso } from './bulk-data.types';

@Injectable()
export class BulkDataReportsService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly customers: BulkCustomersRepository,
    private readonly transactions: BulkTransactionsRepository,
    private readonly bundles: BulkBundlesRepository,
    private readonly secondaryNumbers: BulkSecondaryNumbersRepository,
    private readonly balances: BulkBalancesRepository,
    private readonly auditEvents: BulkAuditEventsRepository,
  ) {}

  async getOverview(query: OverviewQueryDto) {
    await this.access.ensureSeedData();
    const [customers, transactions, bundles] = await Promise.all([
      this.customers.findCreatedDesc(),
      this.transactions.findCreatedDesc({ take: 10 }),
      this.bundles.findByPriceAsc(),
    ]);
    const provisionedTransactions = await this.transactions.findProvisioned();
    const activeCustomers = customers.filter(
      (customer) => customer.status === CustomerStatus.ACTIVE,
    ).length;
    const revenue = provisionedTransactions.reduce(
      (total, transaction) => total + Number(transaction.amountUgx),
      0,
    );
    const purchases = provisionedTransactions.length;
    const secondaryCount = customers.reduce(
      (total, customer) => total + customer.secondaryCount,
      0,
    );

    return ok(
      {
        metrics: [
          {
            label: 'Active customers',
            value: activeCustomers.toLocaleString('en-US'),
            trend: '+8%',
            tone: 'green',
          },
          {
            label: 'Bundle purchases',
            value: purchases.toLocaleString('en-US'),
            trend: '+12%',
            tone: 'yellow',
          },
          {
            label: 'Revenue generated',
            value: `UGX ${revenue.toLocaleString('en-US')}`,
            trend: '+18%',
            tone: 'blue',
          },
          {
            label: 'Secondary numbers',
            value: secondaryCount.toLocaleString('en-US'),
            trend: '+5%',
            tone: 'yellow',
          },
        ],
        integrations: this.buildIntegrationStatus(),
        analytics: {
          revenueTrend: this.buildRevenueTrend(provisionedTransactions, query),
          customerSpend: customers.slice(0, 5).map((customer) => ({
            customerName: customer.businessName,
            spendUgx: Number(customer.totalSpendUgx),
            purchases: customer.bundlePurchases,
            secondaryNumbers: customer.secondaryCount,
          })),
          paymentMix: Object.values(PaymentMethod).map((paymentMethod) => {
            const rows = provisionedTransactions.filter(
              (transaction) => transaction.paymentMethod === paymentMethod,
            );
            return {
              paymentMethod,
              revenueUgx: rows.reduce(
                (total, transaction) => total + Number(transaction.amountUgx),
                0,
              ),
              transactions: rows.length,
            };
          }),
          statusBreakdown: Object.values(TransactionStatus).map((status) => {
            const rows = transactions.filter(
              (transaction) => transaction.status === status,
            );
            return {
              status,
              revenueUgx: rows.reduce(
                (total, transaction) => total + Number(transaction.amountUgx),
                0,
              ),
              transactions: rows.length,
            };
          }),
          integrationLatency: this.buildIntegrationStatus(),
        },
        topCustomers: customers
          .slice(0, 5)
          .map((customer) => serializeCustomer(customer)),
        recentTransactions: transactions.map((transaction) =>
          serializeTransaction(transaction),
        ),
        availablePackages: bundles.map((bundle) => serializeBundle(bundle)),
      },
      'Overview fetched successfully',
    );
  }

  async getAdminReport() {
    await this.access.ensureSeedData();
    const [transactions, customers] = await Promise.all([
      this.transactions.findCreatedDesc(),
      this.customers.findCreatedDesc(),
    ]);

    return ok(
      {
        transactions: transactions.map((transaction) =>
          serializeTransaction(transaction),
        ),
        customerActivity: customers.map((customer) => ({
          customerId: customer.id,
          customerName: customer.businessName,
          createdAt: customer.createdAt.toISOString(),
          totalPrimaryNumbers: customer.primaryMsisdns.length,
          totalSecondaryNumbers: customer.secondaryCount,
          bundlesPurchased: customer.bundlePurchases,
          totalSpendUgx: Number(customer.totalSpendUgx),
          status: customer.status,
        })),
      },
      'Admin report fetched successfully',
    );
  }

  async getTransactionReport(query: ReportTransactionQueryDto) {
    await this.access.ensureSeedData();
    const customers = await this.customers.find();
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );
    const rows = (await this.transactions.findCreatedDesc())
      .filter((row) => !query.customerId || row.customerId === query.customerId)
      .filter(
        (row) =>
          !query.paymentMethod || row.paymentMethod === query.paymentMethod,
      )
      .filter((row) => !query.status || row.status === query.status)
      .filter((row) => withinDateRange(row.createdAt, query))
      .filter((row) =>
        matchesSearch(
          [
            row.id,
            row.customerName,
            row.primaryMsisdn,
            row.bundleName,
            row.status,
          ],
          query.search,
        ),
      );
    const page = paginate(rows, query);
    return okPaginated(
      page.data.map((transaction) => {
        const customer = customerById.get(transaction.customerId);
        return {
          ...serializeTransaction(transaction),
          customerId: transaction.customerId,
          registrationNumber: customer?.registrationNumber ?? 'Unknown',
          apnId: customer?.apnId ?? 'Unknown',
        };
      }),
      page.meta,
      'Transactions fetched successfully',
    );
  }

  async getCustomerReport(actor: AuthenticatedUser, query: ListQueryDto) {
    await this.access.ensureSeedData();
    const customer = await this.access.resolveActorCustomer(actor);
    this.access.assertCanAccessCustomer(actor, customer);
    const transactions = (
      await this.transactions.findByCustomerCreatedDesc(customer.id)
    ).filter((transaction) => withinDateRange(transaction.createdAt, query));
    const secondaryNumbers = (
      await this.secondaryNumbers.find({ where: { customerId: customer.id } })
    ).filter((row) => !query.status || row.status === query.status);
    const balances = await this.balances.find();

    return ok(
      {
        customerId: customer.id,
        bundlePurchaseHistory: transactions.map((transaction) =>
          serializeTransaction(transaction),
        ),
        secondaryNumbers: secondaryNumbers.map((row) =>
          serializeSecondary(row),
        ),
        balances: balances
          .filter((balance) =>
            customer.primaryMsisdns.includes(balance.primaryMsisdn),
          )
          .map((balance) => serializeBalance(balance)),
      },
      'Customer report fetched successfully',
    );
  }

  async listAuditEvents(query: ListQueryDto) {
    await this.access.ensureSeedData();
    const rows = (await this.auditEvents.findCreatedDesc())
      .filter((row) => !query.status || row.outcome === query.status)
      .filter((row) => withinDateRange(row.createdAt, query))
      .filter((row) =>
        matchesSearch(
          [row.category, row.action, row.actor, row.outcome],
          query.search,
        ),
      );
    const page = paginate(rows, query);

    return okPaginated(
      page.data.map((row) => ({
        id: row.id,
        category: row.category,
        action: row.action,
        actor: row.actor,
        outcome: row.outcome,
        createdAt: row.createdAt.toISOString(),
      })),
      page.meta,
      'Audit events fetched successfully',
    );
  }

  private buildRevenueTrend(
    transactions: BulkTransactionEntity[],
    query: OverviewQueryDto,
  ) {
    const period = query.revenuePeriod ?? 'weekly';
    const bucketCount = period === 'daily' ? 30 : period === 'yearly' ? 12 : 4;
    return Array.from({ length: bucketCount }, (_, index) => {
      const rows = transactions.filter(
        (_, transactionIndex) => transactionIndex % bucketCount === index,
      );
      return {
        label: `${period.replace('_', ' ')} ${index + 1}`,
        date: new Date(
          Date.now() - (bucketCount - index) * 86400000,
        ).toISOString(),
        revenueUgx: rows.reduce(
          (total, transaction) => total + Number(transaction.amountUgx),
          0,
        ),
        purchases: rows.length,
      };
    });
  }

  private buildIntegrationStatus() {
    return [
      {
        name: 'Network Provisioning',
        status: 'operational',
        latencyMs: 118,
        lastCheckedAt: nowIso(),
      },
      {
        name: 'Service Validation',
        status: 'operational',
        latencyMs: 92,
        lastCheckedAt: nowIso(),
      },
      {
        name: 'Payments Gateway',
        status: 'operational',
        latencyMs: 156,
        lastCheckedAt: nowIso(),
      },
    ];
  }
}
