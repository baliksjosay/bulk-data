import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('bulk_data_audit_events')
@Index(['category'])
@Index(['createdAt'])
export class BulkAuditEventEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  category: 'security' | 'customer' | 'bundle' | 'integration';

  @Column()
  action: string;

  @Column()
  actor: string;

  @Column()
  outcome: 'success' | 'warning' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
