import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mfa_recovery_code_batches')
export class MfaRecoveryCodeBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  revokedAt?: Date | null;

  @Column({ nullable: true, length: 100 })
  revokedReason?: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  acknowledgedAt?: Date | null;

  @Column({ default: 0 })
  totalCodes: number;

  @Column({ default: 0 })
  usedCodes: number;

  @CreateDateColumn()
  createdAt: Date;
}
