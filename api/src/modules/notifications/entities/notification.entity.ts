import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationDelivery } from './notification-delivery.entity';
import { NotificationRecipient } from './notification-recipient.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';

@Entity('notifications')
@Index(['type', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown>;

  @Column({ nullable: true })
  templateId?: string;

  @Column({ type: 'jsonb', nullable: true })
  templateVariables?: Record<string, string>;

  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId?: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ nullable: true, type: 'timestamptz' })
  scheduledAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  processedAt?: Date;

  @OneToMany(() => NotificationRecipient, (r) => r.notification, {
    cascade: true,
  })
  recipients: NotificationRecipient[];

  @OneToMany(() => NotificationDelivery, (d) => d.notification, {
    cascade: true,
  })
  deliveries: NotificationDelivery[];

  @Column({ default: false })
  isSystemWide: boolean;

  @Column({ nullable: true })
  topic?: string;

  @Column({ nullable: true })
  actionUrl?: string;

  @Column({ nullable: true })
  actionLabel?: string;

  @Column({ nullable: true, unique: false })
  dedupeKey?: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    array: true,
    default: [NotificationChannel.IN_APP],
  })
  channels: NotificationChannel[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
