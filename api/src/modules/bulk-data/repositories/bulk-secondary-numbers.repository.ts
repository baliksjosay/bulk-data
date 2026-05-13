import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkSecondaryNumberEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkSecondaryNumbersRepository extends BulkDataTypeOrmRepository<BulkSecondaryNumberEntity> {
  constructor(
    @InjectRepository(BulkSecondaryNumberEntity)
    repository: Repository<BulkSecondaryNumberEntity>,
  ) {
    super(repository);
  }

  findByCustomerAndPrimary(customerId: string, primaryMsisdn: string) {
    return this.find({
      where: { customerId, primaryMsisdn },
      order: { addedAt: 'DESC' },
    });
  }

  findActiveByMsisdn(msisdn: string) {
    return this.findOne({ where: { msisdn, status: 'active' } });
  }

  findActiveMember(customerId: string, primaryMsisdn: string, msisdn: string) {
    return this.findOne({
      where: {
        customerId,
        primaryMsisdn,
        msisdn,
        status: 'active',
      },
    });
  }

  countActiveMembers(customerId: string, primaryMsisdn: string) {
    return this.count({
      where: { customerId, primaryMsisdn, status: 'active' },
    });
  }
}
