import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { ServiceRequestStatus } from '../dto/bulk-data.dto';

@Entity('bulk_data_service_requests')
@Index(['status'])
@Index(['createdAt'])
export class BulkServiceRequestEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  businessName: string;

  @Column()
  contactPerson: string;

  @Column()
  contactEmail: string;

  @Column()
  contactPhone: string;

  @Column({ nullable: true })
  preferredPackageId?: string;

  @Column({ nullable: true })
  preferredPackageName?: string;

  @Column({ nullable: true })
  message?: string;

  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    default: ServiceRequestStatus.NEW,
  })
  status: ServiceRequestStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
