import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerStatus } from '../dto/bulk-data.dto';

@Entity('bulk_data_customers')
@Index(['registrationNumber'], { unique: true })
@Index(['businessName'])
@Index(['status'])
export class BulkCustomerEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  businessName: string;

  @Column()
  registrationNumber: string;

  @Column()
  businessEmail: string;

  @Column()
  businessPhone: string;

  @Column()
  contactPerson: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column()
  apnName: string;

  @Column()
  apnId: string;

  @Column('simple-array')
  primaryMsisdns: string[];

  @Column({ default: 0 })
  secondaryCount: number;

  @Column({ default: 0 })
  bundlePurchases: number;

  @Column({ type: 'bigint', default: 0 })
  totalSpendUgx: number;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.PENDING,
  })
  status: CustomerStatus;

  @Column({ nullable: true })
  deactivationReason?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
