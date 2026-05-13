import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import {
  PaymentMethod,
  PaymentSessionStatus,
  PrnPaymentProvider,
} from '../dto/bulk-data.dto';

@Entity('bulk_data_payment_sessions')
@Index(['transactionId'])
@Index(['status'])
@Index(['providerTransactionId'])
@Index(['providerReference'])
export class BulkPaymentSessionEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  transactionId: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentSessionStatus })
  status: PaymentSessionStatus;

  @Column({ type: 'bigint' })
  amountUgx: number;

  @Column({ default: 'UGX' })
  currency: 'UGX';

  @Column({ nullable: true })
  prn?: string;

  @Column({ type: 'enum', enum: PrnPaymentProvider, nullable: true })
  provider?: PrnPaymentProvider;

  @Column({ nullable: true })
  providerTransactionId?: string;

  @Column({ nullable: true })
  providerReference?: string;

  @Column({ type: 'timestamptz', nullable: true })
  providerGeneratedAt?: Date;

  @Column({ nullable: true })
  paymentUrl?: string;

  @Column()
  socketEvent: string;

  @Column()
  socketRoom: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column()
  customerId: string;

  @Column()
  bundleId: string;

  @Column()
  provisioningCount: number;
}
