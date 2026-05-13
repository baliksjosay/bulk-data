import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('bulk_data_secondary_numbers')
@Index(['customerId', 'primaryMsisdn'])
@Index(['msisdn', 'status'])
export class BulkSecondaryNumberEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  customerId: string;

  @Column()
  primaryMsisdn: string;

  @Column()
  msisdn: string;

  @Column()
  apnId: string;

  @Column({ default: 'active' })
  status: 'active' | 'removed';

  @Column({ type: 'timestamptz' })
  addedAt: Date;
}
