import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkServiceRequestEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkServiceRequestsRepository extends BulkDataTypeOrmRepository<BulkServiceRequestEntity> {
  constructor(
    @InjectRepository(BulkServiceRequestEntity)
    repository: Repository<BulkServiceRequestEntity>,
  ) {
    super(repository);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }

  findCreatedDesc() {
    return this.find({ order: { createdAt: 'DESC' } });
  }
}
