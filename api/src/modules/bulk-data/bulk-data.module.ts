import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import {
  AuditController,
  BundlesController,
  CustomersController,
  OverviewController,
  PaymentProviderController,
  PurchasesController,
  ReportsController,
  ServiceRequestsController,
} from './controllers';
import {
  BulkAuditEventEntity,
  BulkBalanceEntity,
  BulkBundleEntity,
  BulkCustomerEntity,
  BulkPaymentSessionEntity,
  BulkSecondaryNumberEntity,
  BulkServiceRequestEntity,
  BulkTransactionEntity,
} from './entities';
import {
  BulkAuditEventsRepository,
  BulkBalancesRepository,
  BulkBundlesRepository,
  BulkCustomersRepository,
  BulkPaymentSessionsRepository,
  BulkSecondaryNumbersRepository,
  BulkServiceRequestsRepository,
  BulkTransactionsRepository,
} from './repositories';
import { BulkDataAccessService } from './services/bulk-data-access.service';
import { BulkDataApnProviderService } from './services/bulk-data-apn-provider.service';
import { BulkDataBundlesService } from './services/bulk-data-bundles.service';
import { BulkDataCheckoutService } from './services/bulk-data-checkout.service';
import { BulkDataCustomersService } from './services/bulk-data-customers.service';
import { BulkDataPaymentEventsService } from './services/bulk-data-payment-events.service';
import { BulkDataPaymentProviderService } from './services/bulk-data-payment-provider.service';
import { BulkDataPaymentsService } from './services/bulk-data-payments.service';
import { BulkDataPrnProviderService } from './services/bulk-data-prn-provider.service';
import { BulkDataProvisioningService } from './services/bulk-data-provisioning.service';
import { BulkDataReportsService } from './services/bulk-data-reports.service';
import { BulkDataSeedService } from './services/bulk-data-seed.service';
import { BulkDataService } from './services/bulk-data.service';
import { BulkDataServiceRequestsService } from './services/bulk-data-service-requests.service';

@Module({
  imports: [
    ProvisioningModule,
    TypeOrmModule.forFeature([
      BulkAuditEventEntity,
      BulkBalanceEntity,
      BulkBundleEntity,
      BulkCustomerEntity,
      BulkPaymentSessionEntity,
      BulkSecondaryNumberEntity,
      BulkServiceRequestEntity,
      BulkTransactionEntity,
    ]),
  ],
  controllers: [
    AuditController,
    BundlesController,
    CustomersController,
    OverviewController,
    PaymentProviderController,
    PurchasesController,
    ReportsController,
    ServiceRequestsController,
  ],
  providers: [
    BulkAuditEventsRepository,
    BulkBalancesRepository,
    BulkBundlesRepository,
    BulkCustomersRepository,
    BulkPaymentSessionsRepository,
    BulkSecondaryNumbersRepository,
    BulkServiceRequestsRepository,
    BulkTransactionsRepository,
    BulkDataAccessService,
    BulkDataApnProviderService,
    BulkDataBundlesService,
    BulkDataCheckoutService,
    BulkDataCustomersService,
    BulkDataPaymentEventsService,
    BulkDataPaymentProviderService,
    BulkDataPaymentsService,
    BulkDataPrnProviderService,
    BulkDataProvisioningService,
    BulkDataReportsService,
    BulkDataSeedService,
    BulkDataService,
    BulkDataServiceRequestsService,
  ],
  exports: [BulkDataService],
})
export class BulkDataModule {}
