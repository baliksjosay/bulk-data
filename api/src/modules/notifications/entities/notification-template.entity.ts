import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notification_templates')
@Index(['type', 'channel'], { unique: true })
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column()
  name: string;

  @Column({ nullable: true })
  subject?: string;

  @Column({ type: 'text' })
  bodyTemplate: string;

  @Column({ type: 'text', nullable: true })
  htmlTemplate?: string;

  /** Handlebars / mustache variable names expected in this template */
  @Column({ type: 'jsonb', default: [] })
  variables: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  locale?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
