import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionStatus } from '../dto/bulk-data.dto';
import { BulkTransactionEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkTransactionsRepository extends BulkDataTypeOrmRepository<BulkTransactionEntity> {
  constructor(
    @InjectRepository(BulkTransactionEntity)
    repository: Repository<BulkTransactionEntity>,
  ) {
    super(repository);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }

  findCreatedDesc(options: { take?: number } = {}) {
    return this.find({ order: { createdAt: 'DESC' }, take: options.take });
  }

  findByCustomerCreatedDesc(customerId: string) {
    return this.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  findProvisioned() {
    return this.find({ where: { status: TransactionStatus.PROVISIONED } });
  }
}
