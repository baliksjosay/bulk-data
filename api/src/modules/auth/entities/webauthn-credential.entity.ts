import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores WebAuthn credentials for passkeys, platform authenticators,
 * and roaming security keys.
 */
@Entity('webauthn_credentials')
@Index(['userId'])
@Index(['credentialId'], { unique: true })
export class WebauthnCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 500 })
  credentialId: string;

  @Column({ type: 'varchar', length: 255 })
  publicKey: string;

  @Column({ type: 'bigint', default: 0 })
  counter: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transports?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceType?: string | null;

  @Column({ type: 'boolean', default: false })
  backedUp: boolean;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
