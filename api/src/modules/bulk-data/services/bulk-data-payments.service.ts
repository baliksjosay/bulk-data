import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import {
  BundleStatus,
  CustomerStatus,
  PaymentProviderCallbackDto,
  PaymentSessionStatus,
  PurchaseConfirmationDto,
  PurchaseDto,
  PurchaseRetryDto,
  TransactionStatus,
} from '../dto/bulk-data.dto';
import {
  BulkBundleEntity,
  BulkCustomerEntity,
  BulkPaymentSessionEntity,
  BulkTransactionEntity,
} from '../entities';
import {
  BulkBalancesRepository,
  BulkCustomersRepository,
  BulkPaymentSessionsRepository,
  BulkTransactionsRepository,
} from '../repositories';
import { BulkDataAccessService } from './bulk-data-access.service';
import {
  buildPaymentCallbackLookup,
  getPaymentCallbackReceiptNumber,
  getPaymentCallbackTransactionId,
  isTerminalPaymentStatus,
  normalizeProviderPaymentStatus,
} from './bulk-data-payment-callback';
import { BulkDataPaymentEventsService } from './bulk-data-payment-events.service';
import { BulkDataPaymentProviderService } from './bulk-data-payment-provider.service';
import { buildPurchaseConfirmationResult } from './bulk-data-payment-results';
import { BulkDataProvisioningService } from './bulk-data-provisioning.service';
import { ok, sequenceId } from './bulk-data-query';
import {
  serializePaymentSession,
  serializeTransaction,
} from './bulk-data-serializers';
import { assertPaymentOptions } from './bulk-data-validation';

@Injectable()
export class BulkDataPaymentsService {
  constructor(
    private readonly access: BulkDataAccessService,
    private readonly paymentEvents: BulkDataPaymentEventsService,
    private readonly paymentProvider: BulkDataPaymentProviderService,
    private readonly provisioningService: BulkDataProvisioningService,
    private readonly transactions: BulkTransactionsRepository,
    private readonly paymentSessions: BulkPaymentSessionsRepository,
    private readonly customers: BulkCustomersRepository,
    private readonly balances: BulkBalancesRepository,
  ) {}

  async createPurchase(actor: AuthenticatedUser, dto: PurchaseDto) {
    await this.access.ensureSeedData();
    const [customer, bundle] = await Promise.all([
      this.access.requireCustomer(dto.customerId),
      this.access.requireBundle(dto.bundleId),
    ]);
    this.access.assertCanAccessCustomer(actor, customer);

    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new ForbiddenException('Customer account is not active');
    }

    this.access.assertPrimaryBelongsToCustomer(customer, dto.primaryMsisdn);

    if (bundle.status !== BundleStatus.ACTIVE || !bundle.visible) {
      throw new UnprocessableEntityException(
        'Selected package is not available for purchase',
      );
    }

    assertPaymentOptions(dto.paymentMethod, dto);
    const transaction = await this.transactions.save(
      this.transactions.create({
        id: sequenceId('txn'),
        customerId: customer.id,
        customerName: customer.businessName,
        primaryMsisdn: dto.primaryMsisdn,
        bundleId: bundle.id,
        bundleName: bundle.name,
        paymentMethod: dto.paymentMethod,
        amountUgx: Number(bundle.priceUgx) * dto.provisioningCount,
        status: TransactionStatus.PENDING,
      }),
    );
    const paymentSession = await this.paymentProvider.createPaymentSession(
      transaction,
      bundle,
      dto.provisioningCount,
      {
        prnProvider: dto.prnProvider,
        payingMsisdn: dto.payingMsisdn,
        redirectUrl: dto.redirectUrl,
        autoRenew: dto.autoRenew,
        additionalInfo: dto.additionalInfo,
      },
    );
    this.paymentEvents.emitPaymentStatus(
      paymentSession,
      PaymentSessionStatus.AWAITING_PAYMENT,
      'Payment session created. Waiting for provider confirmation.',
    );
    this.paymentEvents.schedulePaymentStatusSimulation(
      paymentSession,
      (sessionId, status, message) => {
        void this.advanceSimulatedPaymentStatus(sessionId, status, message);
      },
    );
    await this.access.audit(
      'bundle',
      `Payment initiated for ${bundle.serviceCode}`,
      customer.businessName,
      'success',
    );

    return ok(
      {
        transaction: serializeTransaction(transaction),
        paymentSession: serializePaymentSession(paymentSession),
      },
      'Payment initiated successfully',
    );
  }

  async retryPurchase(
    actor: AuthenticatedUser,
    transactionId: string,
    dto: PurchaseRetryDto,
  ) {
    const transaction = await this.access.requireTransaction(transactionId);
    const customer = await this.access.requireCustomer(transaction.customerId);
    const bundle = await this.access.requireBundle(transaction.bundleId);
    this.access.assertCanAccessCustomer(actor, customer);

    if (transaction.status !== TransactionStatus.FAILED) {
      throw new UnprocessableEntityException(
        'Only failed transactions can be retried',
      );
    }

    transaction.status = TransactionStatus.PENDING;
    transaction.paymentMethod = dto.paymentMethod ?? transaction.paymentMethod;
    assertPaymentOptions(transaction.paymentMethod, dto);
    const savedTransaction = await this.transactions.save(transaction);
    const paymentSession = await this.paymentProvider.createPaymentSession(
      savedTransaction,
      bundle,
      1,
      {
        prnProvider: dto.prnProvider,
        payingMsisdn: dto.payingMsisdn,
        redirectUrl: dto.redirectUrl,
        additionalInfo: dto.additionalInfo,
      },
    );
    this.paymentEvents.emitPaymentStatus(
      paymentSession,
      PaymentSessionStatus.AWAITING_PAYMENT,
      'Payment retry session created. Waiting for provider confirmation.',
    );
    this.paymentEvents.schedulePaymentStatusSimulation(
      paymentSession,
      (sessionId, status, message) => {
        void this.advanceSimulatedPaymentStatus(sessionId, status, message);
      },
    );
    await this.access.audit(
      'bundle',
      `Payment retry initiated for ${bundle.serviceCode}`,
      customer.businessName,
      'success',
    );

    return ok(
      {
        transaction: serializeTransaction(savedTransaction),
        paymentSession: serializePaymentSession(paymentSession),
      },
      'Payment retry initiated successfully',
    );
  }

  async confirmPurchase(
    actor: AuthenticatedUser,
    transactionId: string,
    dto: PurchaseConfirmationDto,
  ) {
    const transaction = await this.access.requireTransaction(transactionId);
    const session = await this.paymentSessions.findByIdAndTransaction(
      dto.sessionId,
      transactionId,
    );

    if (!session) {
      throw new NotFoundException('Payment session not found');
    }

    const customer = await this.access.requireCustomer(transaction.customerId);
    this.access.assertCanAccessCustomer(actor, customer);
    const bundle = await this.access.requireBundle(transaction.bundleId);
    const confirmed = dto.status === PaymentSessionStatus.CONFIRMED;

    if (
      transaction.status === TransactionStatus.PROVISIONED &&
      session.status === PaymentSessionStatus.CONFIRMED
    ) {
      return ok(
        buildPurchaseConfirmationResult(transaction, session, true),
        'Payment already confirmed and bundle provisioned',
      );
    }

    if (!confirmed) {
      return this.failPayment(
        transaction,
        session,
        customer,
        bundle,
        'Payment failed by provider.',
        'Payment marked as failed',
      );
    }

    return this.finalizeConfirmedPurchase(
      transaction,
      session,
      customer,
      bundle,
      'Payment confirmed and bundle provisioned successfully.',
      'Payment confirmed and bundle provisioned successfully',
    );
  }

  async handlePaymentProviderCallback(dto: PaymentProviderCallbackDto) {
    const session = await this.paymentSessions.findForProviderCallback(
      buildPaymentCallbackLookup(dto),
    );

    if (!session) {
      throw new NotFoundException('Payment session not found');
    }

    const status = normalizeProviderPaymentStatus(
      dto.status,
      session.paymentMethod,
    );
    const callbackTransactionId = getPaymentCallbackTransactionId(dto);
    const receiptNumber = getPaymentCallbackReceiptNumber(dto);

    if (
      callbackTransactionId &&
      callbackTransactionId !== session.transactionId
    ) {
      throw new BadRequestException('Payment callback transaction mismatch');
    }

    const transaction = await this.access.requireTransaction(
      session.transactionId,
    );
    const [customer, bundle] = await Promise.all([
      this.access.requireCustomer(transaction.customerId),
      this.access.requireBundle(transaction.bundleId),
    ]);

    if (status === PaymentSessionStatus.CONFIRMED) {
      return this.finalizeConfirmedPurchase(
        transaction,
        session,
        customer,
        bundle,
        'Payment confirmed by provider callback.',
        'Payment callback processed successfully',
        receiptNumber,
      );
    }

    if (
      transaction.status === TransactionStatus.PROVISIONED ||
      session.status === PaymentSessionStatus.CONFIRMED
    ) {
      return ok(
        buildPurchaseConfirmationResult(transaction, session, true),
        'Payment already confirmed and bundle provisioned',
      );
    }

    if (
      status === PaymentSessionStatus.PROCESSING ||
      status === PaymentSessionStatus.AWAITING_PAYMENT
    ) {
      session.status = status;
      await this.paymentSessions.save(session);
      this.paymentEvents.emitPaymentStatus(
        session,
        status,
        dto.failureReason ?? 'Payment status updated by provider.',
        receiptNumber,
      );
      return ok(
        buildPurchaseConfirmationResult(transaction, session, false),
        'Payment callback processed successfully',
      );
    }

    return this.failPayment(
      transaction,
      session,
      customer,
      bundle,
      dto.failureReason ?? 'Payment was not completed by provider.',
      'Payment callback processed successfully',
      status,
      receiptNumber,
    );
  }

  private async failPayment(
    transaction: BulkTransactionEntity,
    session: BulkPaymentSessionEntity,
    customer: BulkCustomerEntity,
    bundle: BulkBundleEntity,
    websocketMessage: string,
    responseMessage: string,
    status: PaymentSessionStatus = PaymentSessionStatus.FAILED,
    receiptNumber?: string,
  ) {
    if (
      transaction.status === TransactionStatus.PROVISIONED ||
      session.status === PaymentSessionStatus.CONFIRMED
    ) {
      return ok(
        buildPurchaseConfirmationResult(transaction, session, true),
        'Payment already confirmed and bundle provisioned',
      );
    }

    transaction.status = TransactionStatus.FAILED;
    session.status = status;
    await Promise.all([
      this.transactions.save(transaction),
      this.paymentSessions.save(session),
      this.access.audit(
        'bundle',
        `Payment ${status} for ${bundle.serviceCode}`,
        customer.businessName,
        'warning',
      ),
    ]);
    this.paymentEvents.emitPaymentStatus(
      session,
      status,
      websocketMessage,
      receiptNumber,
    );

    return ok(
      buildPurchaseConfirmationResult(transaction, session, false),
      responseMessage,
    );
  }

  private async finalizeConfirmedPurchase(
    transaction: BulkTransactionEntity,
    session: BulkPaymentSessionEntity,
    customer: BulkCustomerEntity,
    bundle: BulkBundleEntity,
    websocketMessage: string,
    responseMessage: string,
    receiptNumber?: string,
  ) {
    const alreadyProvisioned =
      transaction.status === TransactionStatus.PROVISIONED;
    const previousSessionStatus = session.status;

    transaction.status = TransactionStatus.PROVISIONED;
    session.status = PaymentSessionStatus.CONFIRMED;

    if (alreadyProvisioned) {
      await Promise.all([
        this.transactions.save(transaction),
        this.paymentSessions.save(session),
      ]);

      if (previousSessionStatus !== PaymentSessionStatus.CONFIRMED) {
        this.paymentEvents.emitPaymentStatus(
          session,
          PaymentSessionStatus.CONFIRMED,
          websocketMessage,
          receiptNumber,
        );
      }

      return ok(
        buildPurchaseConfirmationResult(transaction, session, true),
        'Payment already confirmed and bundle provisioned',
      );
    }

    customer.bundlePurchases += session.provisioningCount;
    customer.totalSpendUgx =
      Number(customer.totalSpendUgx) + Number(session.amountUgx);
    const provisioningResult =
      await this.provisioningService.provisionConfirmedPurchase(
        transaction,
        bundle,
      );
    await Promise.all([
      this.transactions.save(transaction),
      this.paymentSessions.save(session),
      this.customers.save(customer),
      this.updateBalanceAfterPurchase(
        customer,
        transaction.primaryMsisdn,
        bundle,
        session.provisioningCount,
      ),
      this.access.audit(
        'bundle',
        `Provisioned ${bundle.serviceCode}`,
        customer.businessName,
        'success',
      ),
    ]);
    this.paymentEvents.emitPaymentStatus(
      session,
      PaymentSessionStatus.CONFIRMED,
      websocketMessage,
      receiptNumber,
    );

    return ok(
      buildPurchaseConfirmationResult(
        transaction,
        session,
        true,
        provisioningResult,
      ),
      responseMessage,
    );
  }

  private async updateBalanceAfterPurchase(
    customer: BulkCustomerEntity,
    primaryMsisdn: string,
    bundle: BulkBundleEntity,
    provisioningCount: number,
  ) {
    this.access.assertPrimaryBelongsToCustomer(customer, primaryMsisdn);
    const balance = await this.access.getOrCreateBalance(primaryMsisdn);
    const totalVolumeGb = bundle.volumeTb * 1024 * provisioningCount;
    balance.bundleName = bundle.name;
    balance.totalVolumeGb = totalVolumeGb;
    balance.remainingVolumeGb = totalVolumeGb;
    balance.expiryAt = new Date(Date.now() + bundle.validityDays * 86400000);
    balance.autoTopupRemaining = Math.max(provisioningCount - 1, 0);
    await this.balances.save(balance);
  }

  private async advanceSimulatedPaymentStatus(
    sessionId: string,
    status: PaymentSessionStatus.PROCESSING | PaymentSessionStatus.CONFIRMED,
    message: string,
  ) {
    const session = await this.paymentSessions.findById(sessionId);

    if (!session || isTerminalPaymentStatus(session.status)) {
      return;
    }

    if (status === PaymentSessionStatus.PROCESSING) {
      session.status = PaymentSessionStatus.PROCESSING;
      await this.paymentSessions.save(session);
      this.paymentEvents.emitPaymentStatus(session, status, message);
      return;
    }

    await this.handlePaymentProviderCallback({
      sessionId: session.id,
      transactionId: session.transactionId,
      status,
    });
  }
}
