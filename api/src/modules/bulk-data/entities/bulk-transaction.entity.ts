import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { PaymentMethod, TransactionStatus } from '../dto/bulk-data.dto';

@Entity('bulk_data_transactions')
@Index(['customerId'])
@Index(['status'])
@Index(['createdAt'])
export class BulkTransactionEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  customerId: string;

  @Column()
  customerName: string;

  @Column()
  primaryMsisdn: string;

  @Column()
  bundleId: string;

  @Column()
  bundleName: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'bigint' })
  amountUgx: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
