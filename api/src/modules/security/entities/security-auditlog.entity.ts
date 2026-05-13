import { SecurityEventType } from 'src/modules/auth/enums/security-event-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('security_audit_logs')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
export class SecurityAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 100 })
  eventType: SecurityEventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceId?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  authMethod?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  authProvider?: string | null;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
