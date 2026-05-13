import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import {
  BundlePackageDto,
  BundlePackageUpdateDto,
  CustomerRegistrationDto,
  CustomerStatusChangeDto,
  CustomerUpdateDto,
  ListQueryDto,
  OverviewQueryDto,
  PaymentProviderCallbackDto,
  PrimaryMsisdnDto,
  PurchaseConfirmationDto,
  PurchaseDto,
  PurchaseRetryDto,
  ReportTransactionQueryDto,
  SecondaryBulkDto,
  SecondaryNumberDto,
  ServiceRequestConversionDto,
  ServiceRequestDto,
  ServiceRequestUpdateDto,
} from '../dto/bulk-data.dto';
import { BulkDataBundlesService } from './bulk-data-bundles.service';
import { BulkDataCheckoutService } from './bulk-data-checkout.service';
import { BulkDataCustomersService } from './bulk-data-customers.service';
import { BulkDataPaymentsService } from './bulk-data-payments.service';
import { BulkDataReportsService } from './bulk-data-reports.service';
import { BulkDataServiceRequestsService } from './bulk-data-service-requests.service';

@Injectable()
export class BulkDataService {
  constructor(
    private readonly reportsService: BulkDataReportsService,
    private readonly customersService: BulkDataCustomersService,
    private readonly bundlesService: BulkDataBundlesService,
    private readonly paymentsService: BulkDataPaymentsService,
    private readonly checkoutService: BulkDataCheckoutService,
    private readonly serviceRequestsService: BulkDataServiceRequestsService,
  ) {}

  getOverview(query: OverviewQueryDto) {
    return this.reportsService.getOverview(query);
  }

  listCustomers(query: ListQueryDto) {
    return this.customersService.listCustomers(query);
  }

  registerCustomer(actor: AuthenticatedUser, dto: CustomerRegistrationDto) {
    return this.customersService.registerCustomer(actor, dto);
  }

  getCustomer(actor: AuthenticatedUser, customerId: string) {
    return this.customersService.getCustomer(actor, customerId);
  }

  updateCustomer(
    actor: AuthenticatedUser,
    customerId: string,
    dto: CustomerUpdateDto,
  ) {
    return this.customersService.updateCustomer(actor, customerId, dto);
  }

  changeCustomerStatus(
    actor: AuthenticatedUser,
    customerId: string,
    dto: CustomerStatusChangeDto,
  ) {
    return this.customersService.changeCustomerStatus(actor, customerId, dto);
  }

  addPrimaryMsisdn(
    actor: AuthenticatedUser,
    customerId: string,
    dto: PrimaryMsisdnDto,
  ) {
    return this.customersService.addPrimaryMsisdn(actor, customerId, dto);
  }

  getBalance(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
  ) {
    return this.customersService.getBalance(actor, customerId, primaryMsisdn);
  }

  listSecondaryNumbers(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    query: ListQueryDto,
  ) {
    return this.customersService.listSecondaryNumbers(
      actor,
      customerId,
      primaryMsisdn,
      query,
    );
  }

  addSecondaryNumber(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    dto: SecondaryNumberDto,
  ) {
    return this.customersService.addSecondaryNumber(
      actor,
      customerId,
      primaryMsisdn,
      dto,
    );
  }

  addSecondaryNumbersBulk(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    dto: SecondaryBulkDto,
  ) {
    return this.customersService.addSecondaryNumbersBulk(
      actor,
      customerId,
      primaryMsisdn,
      dto,
    );
  }

  removeSecondaryNumber(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) {
    return this.customersService.removeSecondaryNumber(
      actor,
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );
  }

  getSecondaryUsage(
    actor: AuthenticatedUser,
    customerId: string,
    primaryMsisdn: string,
    secondaryMsisdn: string,
  ) {
    return this.customersService.getSecondaryUsage(
      actor,
      customerId,
      primaryMsisdn,
      secondaryMsisdn,
    );
  }

  listBundles(query: ListQueryDto) {
    return this.bundlesService.listBundles(query);
  }

  createBundle(actor: AuthenticatedUser, dto: BundlePackageDto) {
    return this.bundlesService.createBundle(actor, dto);
  }

  getBundle(bundleId: string) {
    return this.bundlesService.getBundle(bundleId);
  }

  updateBundle(
    actor: AuthenticatedUser,
    bundleId: string,
    dto: BundlePackageUpdateDto,
  ) {
    return this.bundlesService.updateBundle(actor, bundleId, dto);
  }

  createPurchase(actor: AuthenticatedUser, dto: PurchaseDto) {
    return this.paymentsService.createPurchase(actor, dto);
  }

  retryPurchase(
    actor: AuthenticatedUser,
    transactionId: string,
    dto: PurchaseRetryDto,
  ) {
    return this.paymentsService.retryPurchase(actor, transactionId, dto);
  }

  confirmPurchase(
    actor: AuthenticatedUser,
    transactionId: string,
    dto: PurchaseConfirmationDto,
  ) {
    return this.paymentsService.confirmPurchase(actor, transactionId, dto);
  }

  handlePaymentProviderCallback(dto: PaymentProviderCallbackDto) {
    return this.paymentsService.handlePaymentProviderCallback(dto);
  }

  renderMockProviderCheckout(sessionId: string) {
    return this.checkoutService.renderMockProviderCheckout(sessionId);
  }

  submitServiceRequest(dto: ServiceRequestDto) {
    return this.serviceRequestsService.submitServiceRequest(dto);
  }

  listServiceRequests(query: ListQueryDto) {
    return this.serviceRequestsService.listServiceRequests(query);
  }

  getServiceRequest(serviceRequestId: string) {
    return this.serviceRequestsService.getServiceRequest(serviceRequestId);
  }

  updateServiceRequest(
    actor: AuthenticatedUser,
    serviceRequestId: string,
    dto: ServiceRequestUpdateDto,
  ) {
    return this.serviceRequestsService.updateServiceRequest(
      actor,
      serviceRequestId,
      dto,
    );
  }

  convertServiceRequest(
    actor: AuthenticatedUser,
    serviceRequestId: string,
    dto: ServiceRequestConversionDto,
  ) {
    return this.serviceRequestsService.convertServiceRequest(
      actor,
      serviceRequestId,
      dto,
    );
  }

  getAdminReport() {
    return this.reportsService.getAdminReport();
  }

  getTransactionReport(query: ReportTransactionQueryDto) {
    return this.reportsService.getTransactionReport(query);
  }

  getCustomerReport(actor: AuthenticatedUser, query: ListQueryDto) {
    return this.reportsService.getCustomerReport(actor, query);
  }

  listAuditEvents(query: ListQueryDto) {
    return this.reportsService.listAuditEvents(query);
  }
}
