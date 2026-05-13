import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkAuditEventEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkAuditEventsRepository extends BulkDataTypeOrmRepository<BulkAuditEventEntity> {
  constructor(
    @InjectRepository(BulkAuditEventEntity)
    repository: Repository<BulkAuditEventEntity>,
  ) {
    super(repository);
  }

  findCreatedDesc() {
    return this.find({ order: { createdAt: 'DESC' } });
  }
}
