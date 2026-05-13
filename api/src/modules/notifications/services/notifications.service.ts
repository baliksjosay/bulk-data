import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { MarkReadDto } from '../dto/mark-read.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { Notification } from '../entities/notification.entity';
import { NotificationRecipient } from '../entities/notification-recipient.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async create(dto: CreateNotificationDto, triggeredByUserId?: string): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...dto,
      triggeredByUserId,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepo.save(notification);

    const recipients = dto.recipientIds.map((userId) =>
      this.recipientRepo.create({ notificationId: saved.id, userId }),
    );
    await this.recipientRepo.save(recipients);

    await this.dispatcher.dispatch(saved.id);
    return saved;
  }

  async findForUser(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ data: NotificationRecipient[]; total: number }> {
    const qb = this.recipientRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 20))
      .take(query.limit ?? 20);

    const unreadOnly = query.unreadOnly === true || String(query.unreadOnly).toLowerCase() === 'true';

    if (unreadOnly) {
      qb.andWhere('r.readAt IS NULL');
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('n.type = :type', { type: query.type });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async markRead(userId: string, dto: MarkReadDto): Promise<{ updated: number }> {
    const result = await this.recipientRepo.update(
      { userId, notificationId: In(dto.notificationIds) },
      { status: NotificationStatus.READ, isRead: true, readAt: new Date() },
    );

    return { updated: result.affected ?? 0 };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.recipientRepo
      .createQueryBuilder()
      .update()
      .set({
        status: NotificationStatus.READ,
        isRead: true,
        readAt: new Date(),
      })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.recipientRepo.count({
      where: { userId, readAt: IsNull() },
    });
  }

  async findOneForUser(userId: string, id: string): Promise<NotificationRecipient> {
    const recipient = await this.recipientRepo.findOne({
      where: [
        { id, userId },
        { notificationId: id, userId },
      ],
      relations: ['notification'],
    });

    if (!recipient) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return recipient;
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: ['recipients', 'deliveries'],
    });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }
}
