import {
  BulkBalanceEntity,
  BulkBundleEntity,
  BulkCustomerEntity,
  BulkPaymentSessionEntity,
  BulkSecondaryNumberEntity,
  BulkServiceRequestEntity,
  BulkTransactionEntity,
} from '../entities';

export function serializeCustomer(customer: BulkCustomerEntity) {
  return {
    id: customer.id,
    businessName: customer.businessName,
    registrationNumber: customer.registrationNumber,
    tin: customer.tin,
    businessEmail: customer.businessEmail,
    businessPhone: customer.businessPhone,
    contactPerson: customer.contactPerson,
    email: customer.email,
    phone: customer.phone,
    apnName: customer.apnName,
    apnId: customer.apnId,
    primaryMsisdns: customer.primaryMsisdns,
    secondaryCount: customer.secondaryCount,
    bundlePurchases: customer.bundlePurchases,
    totalSpendUgx: Number(customer.totalSpendUgx),
    status: customer.status,
    deactivationReason: customer.deactivationReason,
    createdAt: customer.createdAt.toISOString(),
  };
}

export function serializeBundle(bundle: BulkBundleEntity) {
  return {
    id: bundle.id,
    serviceCode: bundle.serviceCode,
    name: bundle.name,
    volumeTb: bundle.volumeTb,
    priceUgx: Number(bundle.priceUgx),
    validityDays: bundle.validityDays,
    status: bundle.status,
    visible: bundle.visible,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString(),
  };
}

export function serializeSecondary(secondaryNumber: BulkSecondaryNumberEntity) {
  return {
    id: secondaryNumber.id,
    customerId: secondaryNumber.customerId,
    primaryMsisdn: secondaryNumber.primaryMsisdn,
    msisdn: secondaryNumber.msisdn,
    apnId: secondaryNumber.apnId,
    status: secondaryNumber.status,
    addedAt: secondaryNumber.addedAt.toISOString(),
  };
}

export function serializeBalance(balance: BulkBalanceEntity) {
  return {
    primaryMsisdn: balance.primaryMsisdn,
    bundleName: balance.bundleName,
    totalVolumeGb: Number(balance.totalVolumeGb),
    remainingVolumeGb: Number(balance.remainingVolumeGb),
    expiryAt: balance.expiryAt.toISOString(),
    autoTopupRemaining: balance.autoTopupRemaining,
  };
}

export function serializeTransaction(transaction: BulkTransactionEntity) {
  return {
    id: transaction.id,
    customerName: transaction.customerName,
    primaryMsisdn: transaction.primaryMsisdn,
    bundleName: transaction.bundleName,
    paymentMethod: transaction.paymentMethod,
    amountUgx: Number(transaction.amountUgx),
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function serializePaymentSession(
  paymentSession: BulkPaymentSessionEntity,
) {
  return {
    id: paymentSession.id,
    transactionId: paymentSession.transactionId,
    paymentMethod: paymentSession.paymentMethod,
    status: paymentSession.status,
    amountUgx: Number(paymentSession.amountUgx),
    currency: paymentSession.currency,
    prn: paymentSession.prn,
    provider: paymentSession.provider,
    providerTransactionId: paymentSession.providerTransactionId,
    providerReference: paymentSession.providerReference,
    providerGeneratedAt: paymentSession.providerGeneratedAt?.toISOString(),
    paymentUrl: paymentSession.paymentUrl,
    socketEvent: paymentSession.socketEvent,
    socketRoom: paymentSession.socketRoom,
    expiresAt: paymentSession.expiresAt.toISOString(),
    createdAt: paymentSession.createdAt.toISOString(),
    customerId: paymentSession.customerId,
    bundleId: paymentSession.bundleId,
    provisioningCount: paymentSession.provisioningCount,
  };
}

export function serializeServiceRequest(
  serviceRequest: BulkServiceRequestEntity,
) {
  return {
    id: serviceRequest.id,
    businessName: serviceRequest.businessName,
    contactPerson: serviceRequest.contactPerson,
    contactEmail: serviceRequest.contactEmail,
    contactPhone: serviceRequest.contactPhone,
    preferredPackageId: serviceRequest.preferredPackageId,
    preferredPackageName: serviceRequest.preferredPackageName,
    message: serviceRequest.message,
    status: serviceRequest.status,
    createdAt: serviceRequest.createdAt.toISOString(),
  };
}
