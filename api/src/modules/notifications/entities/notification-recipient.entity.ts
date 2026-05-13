import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationStatus } from '../enums/notification-status.enum';
import { Notification } from './notification.entity';

@Entity('notification_recipients')
@Index(['notificationId', 'userId'])
@Index(['userId', 'readAt'])
@Index(['userId', 'createdAt'])
export class NotificationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, (n) => n.recipients, { onDelete: 'CASCADE' })
  notification: Notification;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ nullable: true, type: 'timestamptz' })
  readAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  dismissedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
