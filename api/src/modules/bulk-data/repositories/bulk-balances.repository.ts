import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkBalanceEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkBalancesRepository extends BulkDataTypeOrmRepository<BulkBalanceEntity> {
  constructor(
    @InjectRepository(BulkBalanceEntity)
    repository: Repository<BulkBalanceEntity>,
  ) {
    super(repository);
  }

  findByPrimaryMsisdn(primaryMsisdn: string) {
    return this.findOne({ where: { primaryMsisdn } });
  }
}
