import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthFactorType } from '../enums/auth-factor-type.enum';

/**
 * Stores registered authentication factors for a user, such as
 * password, TOTP, WebAuthn credentials, passkeys, and security keys.
 */
@Entity('user_auth_factors')
@Index(['userId', 'type'])
export class UserAuthFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: AuthFactorType })
  type: AuthFactorType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label?: string | null;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  publicMetadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
