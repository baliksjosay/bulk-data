import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkBundleEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkBundlesRepository extends BulkDataTypeOrmRepository<BulkBundleEntity> {
  constructor(
    @InjectRepository(BulkBundleEntity)
    repository: Repository<BulkBundleEntity>,
  ) {
    super(repository);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }

  findByServiceCode(serviceCode: string) {
    return this.findOne({ where: { serviceCode } });
  }

  findByPriceAsc() {
    return this.find({ order: { priceUgx: 'ASC' } });
  }
}
