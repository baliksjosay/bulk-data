import { ClassConstructor, plainToInstance } from 'class-transformer';

export function toDto<T, V>(cls: ClassConstructor<T>, data: V): T {
  return plainToInstance(cls, data, {
    excludeExtraneousValues: true,
  });
}

export function toDtos<T, V>(cls: ClassConstructor<T>, data: V[]): T[] {
  return plainToInstance(cls, data, {
    excludeExtraneousValues: true,
  });
}
