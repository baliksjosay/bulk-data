import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, LessThanOrEqual, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AuthProvider } from '../enums/auth-provider.enum';
import { UserQueryDto } from '../dto/user-query.dto';
import { UserStatus } from '../enums/user-status.enum';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  create(payload: Partial<User>): User {
    return this.repo.create(payload);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['preferences'],
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();

    if (includePassword) {
      return this.repo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .leftJoinAndSelect('user.preferences', 'preferences')
        .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
        .getOne();
    }

    return this.repo.findOne({
      where: { email: normalizedEmail },
      relations: ['preferences'],
    });
  }

  async findByPhoneNumber(
    phoneNumber: string,
    includePassword = false,
  ): Promise<User | null> {
    if (includePassword) {
      return this.repo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .leftJoinAndSelect('user.preferences', 'preferences')
        .where('user.phoneNumber = :phoneNumber', { phoneNumber })
        .getOne();
    }

    return this.repo.findOne({
      where: { phoneNumber },
      relations: ['preferences'],
    });
  }

  async findByExternalId(
    externalId: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedExternalId = externalId.trim().toLowerCase();

    if (includePassword) {
      return this.repo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .leftJoinAndSelect('user.preferences', 'preferences')
        .where('user.externalId = :externalId', {
          externalId: normalizedExternalId,
        })
        .getOne();
    }

    return this.repo.findOne({
      where: { externalId: normalizedExternalId },
      relations: ['preferences'],
    });
  }

  async findByExternalIdentity(
    authProvider: AuthProvider,
    externalId: string,
  ): Promise<User | null> {
    return this.repo.findOne({
      where: { authProvider, externalId },
      relations: ['preferences'],
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { email: email.trim().toLowerCase() },
    });
    return count > 0;
  }

  async existsByPhoneNumber(phoneNumber: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { phoneNumber },
    });
    return count > 0;
  }

  async existsByExternalId(externalId: string): Promise<boolean> {
    const count = await this.repo.count({
      where: { externalId: externalId.trim().toLowerCase() },
    });
    return count > 0;
  }

  async findAll(query: UserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.preferences', 'preferences')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    if (query.authProvider) {
      qb.andWhere('user.authProvider = :authProvider', {
        authProvider: query.authProvider,
      });
    }

    if (query.role) {
      qb.andWhere(':role = ANY(user.roles)', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('LOWER(user.firstName) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            })
            .orWhere('LOWER(user.lastName) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            })
            .orWhere('LOWER(user.email) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            })
            .orWhere('LOWER(user.phoneNumber) LIKE LOWER(:search)', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, payload: Partial<User>): Promise<void> {
    await this.repo.update(id, payload);
  }

  async remove(user: User): Promise<User> {
    return this.repo.remove(user);
  }
  /**
   * Finds users whose accounts are currently locked but whose lock window
   * has already expired.
   *
   * This is mainly used by scheduled jobs that automatically unlock accounts.
   */
  async findExpiredLockedUsers(): Promise<User[]> {
    return this.repo.find({
      where: {
        isLocked: true,
        status: UserStatus.LOCKED,
        lockedUntil: LessThanOrEqual(new Date()),
      },
    });
  }
}
