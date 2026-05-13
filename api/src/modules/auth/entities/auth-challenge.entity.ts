import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthChallengeType } from '../enums/auth-challenge-type.enum';

/**
 * Stores short-lived challenges for MFA, verification, password reset,
 * activation, and WebAuthn ceremonies.
 */
@Entity('auth_challenges')
@Index(['userId', 'type'])
@Index(['expiresAt'])
export class AuthChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'enum', enum: AuthChallengeType })
  type: AuthChallengeType;

  @Column({ type: 'varchar', length: 255, unique: true })
  challenge: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isUsed: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
