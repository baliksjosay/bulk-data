import { AuthFactorType } from 'src/modules/auth/enums/auth-factor-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';



@Entity('user_auth_factors')
@Index(['userId', 'type'])
export class UserAuthFactor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
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
  config?: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  publicMetadata?: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
