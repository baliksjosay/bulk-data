export type RealtimeDomainEntity =
  | 'notification'
  | 'payment'
  | 'service_request'
  | 'customer'
  | 'primary_msisdn'
  | 'secondary_msisdn'
  | 'bundle'
  | 'balance';

export type RealtimeDomainAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'converted'
  | 'processing'
  | 'confirmed'
  | 'failed'
  | 'expired'
  | 'provisioned'
  | 'removed'
  | 'awaiting_payment';

export interface RealtimeDomainEvent {
  entity: RealtimeDomainEntity;
  action: RealtimeDomainAction;
  entityId?: string;
  userId?: string;
  customerId?: string;
  transactionId?: string;
  paymentSessionId?: string;
  status?: string;
  message: string;
  occurredAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
