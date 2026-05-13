import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
} from 'typeorm';

export abstract class BulkDataTypeOrmRepository<Entity extends ObjectLiteral> {
  protected constructor(protected readonly repository: Repository<Entity>) {}

  create(input: DeepPartial<Entity>) {
    return this.repository.create(input);
  }

  createMany(input: DeepPartial<Entity>[]) {
    return this.repository.create(input);
  }

  save(entity: Entity): Promise<Entity>;
  save(entities: Entity[]): Promise<Entity[]>;
  save(entityOrEntities: Entity | Entity[]) {
    return Array.isArray(entityOrEntities)
      ? this.repository.save(entityOrEntities)
      : this.repository.save(entityOrEntities);
  }

  find(options?: FindManyOptions<Entity>) {
    return this.repository.find(options);
  }

  findOne(options: FindOneOptions<Entity>) {
    return this.repository.findOne(options);
  }

  count(options?: FindManyOptions<Entity>) {
    return this.repository.count(options);
  }
}
