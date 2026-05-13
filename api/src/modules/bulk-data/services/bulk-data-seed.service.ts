import { Injectable } from '@nestjs/common';
import {
  BundleStatus,
  CustomerStatus,
  PaymentMethod,
  ServiceRequestStatus,
  TransactionStatus,
} from '../dto/bulk-data.dto';
import { BulkBundleEntity } from '../entities';
import {
  BulkAuditEventsRepository,
  BulkBalancesRepository,
  BulkBundlesRepository,
  BulkCustomersRepository,
  BulkSecondaryNumbersRepository,
  BulkServiceRequestsRepository,
  BulkTransactionsRepository,
} from '../repositories';
import { sequenceId } from './bulk-data-query';

@Injectable()
export class BulkDataSeedService {
  constructor(
    private readonly customers: BulkCustomersRepository,
    private readonly bundles: BulkBundlesRepository,
    private readonly secondaryNumbers: BulkSecondaryNumbersRepository,
    private readonly balances: BulkBalancesRepository,
    private readonly transactions: BulkTransactionsRepository,
    private readonly serviceRequests: BulkServiceRequestsRepository,
    private readonly auditEvents: BulkAuditEventsRepository,
  ) {}

  async ensureSeedData() {
    const bundles = await this.ensureSampleBundles();
    const count = await this.customers.count();

    if (count > 0) {
      await this.ensureDemoCustomer();
      return;
    }

    const createdAt = new Date('2026-04-21T09:00:00+03:00');
    const customers = await this.customers.save([
      this.customers.create({
        id: 'cus-wavenet',
        businessName: 'WaveNet',
        registrationNumber: '1000004829',
        businessEmail: 'business@wavenet.ug',
        businessPhone: '+256772100200',
        contactPerson: 'Sarah Namuli',
        email: 'operations@wavenet.ug',
        phone: '+256772100201',
        apnName: 'wavenet.mtn.ug',
        apnId: 'APN-1092',
        primaryMsisdns: ['+256772990001', '+256772990002'],
        secondaryCount: 2,
        bundlePurchases: 2,
        totalSpendUgx: 6600000,
        status: CustomerStatus.ACTIVE,
        createdAt,
      }),
      this.customers.create({
        id: 'cus-skyconnect',
        businessName: 'SkyConnect',
        registrationNumber: '1000005631',
        businessEmail: 'business@skyconnect.ug',
        businessPhone: '+256782430900',
        contactPerson: 'Daniel Kato',
        email: 'admin@skyconnect.ug',
        phone: '+256782430911',
        apnName: 'skyconnect.mtn.ug',
        apnId: 'APN-1177',
        primaryMsisdns: ['+256772990101'],
        secondaryCount: 1,
        bundlePurchases: 1,
        totalSpendUgx: 2300000,
        status: CustomerStatus.ACTIVE,
        createdAt,
      }),
      this.createDemoCustomerSeed(new Date('2026-04-21T11:00:00+03:00')),
    ]);

    await this.secondaryNumbers.save([
      this.secondaryNumbers.create({
        id: 'sec-1',
        customerId: customers[0].id,
        primaryMsisdn: '+256772990001',
        msisdn: '+256772991001',
        apnId: customers[0].apnId,
        status: 'active',
        addedAt: createdAt,
      }),
      this.secondaryNumbers.create({
        id: 'sec-2',
        customerId: customers[0].id,
        primaryMsisdn: '+256772990001',
        msisdn: '+256772991002',
        apnId: customers[0].apnId,
        status: 'active',
        addedAt: createdAt,
      }),
      this.secondaryNumbers.create({
        id: 'sec-3',
        customerId: customers[1].id,
        primaryMsisdn: '+256772990101',
        msisdn: '+256772991101',
        apnId: customers[1].apnId,
        status: 'active',
        addedAt: createdAt,
      }),
    ]);

    await this.balances.save([
      this.balances.create({
        primaryMsisdn: '+256772990001',
        bundleName: bundles[2].name,
        totalVolumeGb: 2048,
        remainingVolumeGb: 1286,
        expiryAt: new Date('2026-05-20T23:59:59+03:00'),
        autoTopupRemaining: 1,
      }),
      this.balances.create({
        primaryMsisdn: '+256772990002',
        bundleName: bundles[1].name,
        totalVolumeGb: 1024,
        remainingVolumeGb: 904,
        expiryAt: new Date('2026-05-19T23:59:59+03:00'),
        autoTopupRemaining: 0,
      }),
      this.balances.create({
        primaryMsisdn: '+256772990101',
        bundleName: bundles[1].name,
        totalVolumeGb: 1024,
        remainingVolumeGb: 412,
        expiryAt: new Date('2026-05-18T23:59:59+03:00'),
        autoTopupRemaining: 0,
      }),
      this.balances.create({
        primaryMsisdn: '+256789172796',
        bundleName: 'No active bundle',
        totalVolumeGb: 0,
        remainingVolumeGb: 0,
        expiryAt: new Date('2026-05-21T23:59:59+03:00'),
        autoTopupRemaining: 0,
      }),
    ]);

    await this.transactions.save([
      this.transactions.create({
        id: 'txn-1005',
        customerId: customers[0].id,
        customerName: customers[0].businessName,
        primaryMsisdn: '+256772990001',
        bundleId: bundles[2].id,
        bundleName: bundles[2].name,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        amountUgx: 4300000,
        status: TransactionStatus.PROVISIONED,
      }),
      this.transactions.create({
        id: 'txn-1004',
        customerId: customers[1].id,
        customerName: customers[1].businessName,
        primaryMsisdn: '+256772990101',
        bundleId: bundles[1].id,
        bundleName: bundles[1].name,
        paymentMethod: PaymentMethod.CARD,
        amountUgx: 2300000,
        status: TransactionStatus.PROVISIONED,
      }),
    ]);

    await this.serviceRequests.save([
      this.serviceRequests.create({
        id: 'srv-1001',
        businessName: 'Kampala Fiber Hub',
        contactPerson: 'Grace Nansubuga',
        contactEmail: 'operations@kampalafiber.ug',
        contactPhone: '+256772441120',
        preferredPackageId: bundles[1].id,
        preferredPackageName: bundles[1].name,
        message: 'We need data pooling for branch routers and field teams.',
        status: ServiceRequestStatus.NEW,
      }),
    ]);

    await this.auditEvents.save(
      this.auditEvents.create({
        id: sequenceId('aud'),
        category: 'customer',
        action: 'Seed customer data initialized',
        actor: 'System',
        outcome: 'success',
      }),
    );
  }

  private async ensureSampleBundles() {
    const seedBundles = [
      {
        id: 'bundle-500gb',
        serviceCode: 'BDS-500G-30D',
        name: 'Wholesale 500 GB',
        volumeTb: 0.5,
        priceUgx: 1250000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-1tb',
        serviceCode: 'BDS-1T-30D',
        name: 'Wholesale 1 TB',
        volumeTb: 1,
        priceUgx: 2300000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-2tb',
        serviceCode: 'BDS-2T-30D',
        name: 'Wholesale 2 TB',
        volumeTb: 2,
        priceUgx: 4300000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-4tb',
        serviceCode: 'BDS-4T-30D',
        name: 'Wholesale 4 TB',
        volumeTb: 4,
        priceUgx: 8000000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-250gb',
        serviceCode: 'BDS-250G-30D',
        name: 'Wholesale 250 GB',
        volumeTb: 0.25,
        priceUgx: 650000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-750gb',
        serviceCode: 'BDS-750G-30D',
        name: 'Wholesale 750 GB',
        volumeTb: 0.75,
        priceUgx: 1800000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-1p5tb',
        serviceCode: 'BDS-1P5T-30D',
        name: 'Wholesale 1.5 TB',
        volumeTb: 1.5,
        priceUgx: 3300000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
      {
        id: 'bundle-3tb',
        serviceCode: 'BDS-3T-30D',
        name: 'Wholesale 3 TB',
        volumeTb: 3,
        priceUgx: 6100000,
        validityDays: 30,
        status: BundleStatus.ACTIVE,
        visible: true,
      },
    ];
    const existingBundles = await this.bundles.find({ select: { id: true } });
    const existingBundleIds = new Set(
      existingBundles.map((bundle) => bundle.id),
    );
    const missingBundles = seedBundles.filter(
      (bundle) => !existingBundleIds.has(bundle.id),
    );

    if (missingBundles.length > 0) {
      await this.bundles.save(
        missingBundles.map((bundle) => this.bundles.create(bundle)),
      );
    }

    const savedBundles = await this.bundles.find({
      where: seedBundles.map((bundle) => ({ id: bundle.id })),
    });
    const savedBundlesById = new Map(
      savedBundles.map((bundle) => [bundle.id, bundle]),
    );

    return seedBundles
      .map((bundle) => savedBundlesById.get(bundle.id))
      .filter((bundle): bundle is BulkBundleEntity => Boolean(bundle));
  }

  private createDemoCustomerSeed(createdAt: Date) {
    return this.customers.create({
      id: 'cus-baliksjosay',
      businessName: 'Baliks Josay',
      registrationNumber: '1000172796',
      businessEmail: 'baliksjosay@gmail.com',
      businessPhone: '+256789172796',
      contactPerson: 'Baliks Josay',
      email: 'baliksjosay@gmail.com',
      phone: '+256789172796',
      apnName: 'baliksjosay.mtn.ug',
      apnId: 'APN-172796',
      primaryMsisdns: ['+256789172796'],
      secondaryCount: 0,
      bundlePurchases: 0,
      totalSpendUgx: 0,
      status: CustomerStatus.ACTIVE,
      createdAt,
    });
  }

  private async ensureDemoCustomer() {
    const existing = await this.customers.findById('cus-baliksjosay');

    if (existing) {
      if (existing.registrationNumber !== '1000172796') {
        existing.registrationNumber = '1000172796';
        await this.customers.save(existing);
      }
      return;
    }

    await this.customers.save(
      this.createDemoCustomerSeed(new Date('2026-04-21T11:00:00+03:00')),
    );
    await this.createZeroBalance('+256789172796');
  }

  private createZeroBalance(primaryMsisdn: string) {
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
}
