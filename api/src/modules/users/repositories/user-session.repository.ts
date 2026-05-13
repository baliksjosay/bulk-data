import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';

@Injectable()
export class UserSessionRepository {
  constructor(
    @InjectRepository(UserSession)
    private readonly repo: Repository<UserSession>,
  ) {}

  create(payload: Partial<UserSession>): UserSession {
    return this.repo.create(payload);
  }

  save(session: UserSession): Promise<UserSession> {
    return this.repo.save(session);
  }

  findById(id: string): Promise<UserSession | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  findActiveByUserId(userId: string): Promise<UserSession[]> {
    return this.repo.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findExpiredActiveSessions(): Promise<UserSession[]> {
    return this.repo.find({
      where: {
        isActive: true,
        expiresAt: LessThan(new Date()),
      },
      relations: ['user'],
    });
  }

  async deactivateById(id: string, reason?: string): Promise<void> {
    await this.repo.update(id, {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason ?? 'deactivated',
    });
  }

  async deactivateAllForUser(userId: string, reason?: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(UserSession)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason ?? 'deactivated_all',
      })
      .where('userId = :userId', { userId })
      .andWhere('isActive = true')
      .execute();
  }

  async deactivateExpiredSessions(reason = 'expired'): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(UserSession)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where('isActive = true')
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  async touch(id: string): Promise<void> {
    await this.repo.update(id, {
      lastActivityAt: new Date(),
    });
  }
}
