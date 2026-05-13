import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BulkPaymentSessionEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkPaymentSessionsRepository extends BulkDataTypeOrmRepository<BulkPaymentSessionEntity> {
  constructor(
    @InjectRepository(BulkPaymentSessionEntity)
    repository: Repository<BulkPaymentSessionEntity>,
  ) {
    super(repository);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }

  findByIdAndTransaction(id: string, transactionId: string) {
    return this.findOne({ where: { id, transactionId } });
  }

  findForProviderCallback(input: {
    sessionId?: string;
    transactionId?: string;
    providerTransactionId?: string;
    providerReference?: string;
  }) {
    const where: FindOptionsWhere<BulkPaymentSessionEntity>[] = [];

    if (input.sessionId) {
      where.push({ id: input.sessionId });
    }

    if (input.providerTransactionId) {
      where.push({ providerTransactionId: input.providerTransactionId });
    }

    if (input.providerReference) {
      where.push({ providerReference: input.providerReference });
    }

    if (input.transactionId) {
      where.push({ transactionId: input.transactionId });
    }

    if (!where.length) {
      return Promise.resolve(null);
    }

    return this.findOne({
      where,
      order: { createdAt: 'DESC' },
    });
  }
}
