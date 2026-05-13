import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { Notification } from './notification.entity';
import { NotificationRecipient } from './notification-recipient.entity';

@Entity('notification_deliveries')
@Index(['notificationId', 'channel'])
@Index(['recipientUserId', 'channel', 'status'])
@Index(['status', 'createdAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, (n) => n.deliveries, { onDelete: 'CASCADE' })
  notification: Notification;

  @Column({ type: 'uuid' })
  recipientUserId: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @ManyToOne(() => NotificationRecipient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationRecipientId' })
  recipient: NotificationRecipient;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ nullable: true })
  externalId?: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage?: string;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ nullable: true, type: 'timestamptz' })
  lastAttemptAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  sentAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  deliveredAt?: Date;

  @Column({ type: 'uuid' })
  notificationRecipientId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
