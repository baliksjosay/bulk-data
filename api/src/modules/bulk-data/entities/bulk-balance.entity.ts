import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bulk_data_balances')
@Index(['primaryMsisdn'], { unique: true })
export class BulkBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  primaryMsisdn: string;

  @Column()
  bundleName: string;

  @Column({ type: 'float', default: 0 })
  totalVolumeGb: number;

  @Column({ type: 'float', default: 0 })
  remainingVolumeGb: number;

  @Column({ type: 'timestamptz' })
  expiryAt: Date;

  @Column({ default: 0 })
  autoTopupRemaining: number;
}
