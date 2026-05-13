import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BundleStatus } from '../dto/bulk-data.dto';

@Entity('bulk_data_bundles')
@Index(['serviceCode'], { unique: true })
@Index(['status'])
export class BulkBundleEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  serviceCode: string;

  @Column()
  name: string;

  @Column({ type: 'float' })
  volumeTb: number;

  @Column({ type: 'bigint' })
  priceUgx: number;

  @Column({ default: 30 })
  validityDays: number;

  @Column({ type: 'enum', enum: BundleStatus, default: BundleStatus.ACTIVE })
  status: BundleStatus;

  @Column({ default: true })
  visible: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
