import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mfa_recovery_codes')
@Index(['userId', 'batchId'])
export class MfaRecoveryCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column()
  batchId: string;

  @Column()
  codeHash: string;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  usedAt?: Date | null;

  @Column({ nullable: true, length: 100 })
  usedFor?: string | null;

  @Column({ nullable: true, type: 'varchar', length: 45 })
  usedFromIp?: string | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  usedUserAgent?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
