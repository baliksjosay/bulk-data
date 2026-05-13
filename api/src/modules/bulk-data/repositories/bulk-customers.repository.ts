import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkCustomerEntity } from '../entities';
import { BulkDataTypeOrmRepository } from './bulk-data-typeorm.repository';

@Injectable()
export class BulkCustomersRepository extends BulkDataTypeOrmRepository<BulkCustomerEntity> {
  constructor(
    @InjectRepository(BulkCustomerEntity)
    repository: Repository<BulkCustomerEntity>,
  ) {
    super(repository);
  }

  findById(id: string) {
    return this.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.findOne({ where: { email } });
  }

  findByRegistrationNumber(registrationNumber: string) {
    return this.repository
      .createQueryBuilder('customer')
      .where(
        'LOWER(customer.registrationNumber) = LOWER(:registrationNumber)',
        {
          registrationNumber: registrationNumber.trim(),
        },
      )
      .getOne();
  }

  findCreatedDesc() {
    return this.find({ order: { createdAt: 'DESC' } });
  }
}
