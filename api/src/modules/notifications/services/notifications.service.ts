import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { MarkReadDto } from '../dto/mark-read.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { Notification } from '../entities/notification.entity';
import { NotificationRecipient } from '../entities/notification-recipient.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { User } from 'src/modules/users/entities/user.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { WebsocketGateway } from './notification-websocket.service';

const VISIBLE_IN_APP_STATUSES = [
  NotificationStatus.DELIVERED,
  NotificationStatus.READ,
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationRecipient)
    private readonly recipientRepo: Repository<NotificationRecipient>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async create(
    dto: CreateNotificationDto,
    triggeredByUserId?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...dto,
      triggeredByUserId,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepo.save(notification);

    const recipientUsers = await this.userRepo.find({
      where: { id: In(dto.recipientIds) },
      select: ['id', 'email', 'phoneNumber'],
    });
    const usersById = new Map(recipientUsers.map((user) => [user.id, user]));

    const recipients = dto.recipientIds.map((userId) => {
      const user = usersById.get(userId);

      return this.recipientRepo.create({
        notificationId: saved.id,
        userId,
        email: user?.email,
        phoneNumber: user?.phoneNumber,
      });
    });
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
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .andWhere('r.status IN (:...visibleStatuses)', {
        visibleStatuses: VISIBLE_IN_APP_STATUSES,
      })
      .orderBy('n.createdAt', 'DESC')
      .skip(((query.page ?? 1) - 1) * (query.limit ?? 20))
      .take(query.limit ?? 20);

    const unreadOnly =
      query.unreadOnly === true ||
      String(query.unreadOnly).toLowerCase() === 'true';

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

  async markRead(
    userId: string,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    const ids = dto.notificationIds;

    if (!ids.length) {
      return { updated: 0 };
    }

    const recipients = await this.recipientRepo
      .createQueryBuilder('r')
      .leftJoin('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .andWhere('(r.id IN (:...ids) OR r.notificationId IN (:...ids))', {
        ids,
      })
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .andWhere('r.status IN (:...visibleStatuses)', {
        visibleStatuses: VISIBLE_IN_APP_STATUSES,
      })
      .select(['r.id', 'r.notificationId'])
      .getMany();

    if (!recipients.length) {
      return { updated: 0 };
    }

    const result = await this.recipientRepo.update(
      { id: In(recipients.map((recipient) => recipient.id)) },
      { status: NotificationStatus.READ, isRead: true, readAt: new Date() },
    );
    const updated = result.affected ?? 0;

    if (updated > 0) {
      recipients.forEach((recipient) => {
        this.websocketGateway.sendNotificationRead(
          userId,
          recipient.notificationId,
        );
      });
      await this.websocketGateway.sendUnreadCountUpdate(
        userId,
        await this.getUnreadCount(userId),
      );
    }

    return { updated };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const recipients = await this.recipientRepo
      .createQueryBuilder('r')
      .leftJoin('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .andWhere('r.readAt IS NULL')
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .andWhere('r.status IN (:...visibleStatuses)', {
        visibleStatuses: VISIBLE_IN_APP_STATUSES,
      })
      .select('r.id')
      .getMany();

    if (!recipients.length) {
      return { updated: 0 };
    }

    const result = await this.recipientRepo.update(
      { id: In(recipients.map((recipient) => recipient.id)) },
      { status: NotificationStatus.READ, isRead: true, readAt: new Date() },
    );
    const updated = result.affected ?? 0;

    if (updated > 0) {
      this.websocketGateway.sendAllNotificationsRead(userId);
      await this.websocketGateway.sendUnreadCountUpdate(userId, 0);
    }

    return { updated };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.recipientRepo
      .createQueryBuilder('r')
      .leftJoin('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .andWhere('r.readAt IS NULL')
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .andWhere('r.status IN (:...visibleStatuses)', {
        visibleStatuses: VISIBLE_IN_APP_STATUSES,
      })
      .getCount();
  }

  async findOneForUser(
    userId: string,
    id: string,
  ): Promise<NotificationRecipient> {
    const recipient = await this.recipientRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.notification', 'n')
      .where('r.userId = :userId', { userId })
      .andWhere('(r.id = :id OR r.notificationId = :id)', { id })
      .andWhere(':inAppChannel = ANY(n.channels)', {
        inAppChannel: NotificationChannel.IN_APP,
      })
      .andWhere('r.status IN (:...visibleStatuses)', {
        visibleStatuses: VISIBLE_IN_APP_STATUSES,
      })
      .getOne();

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
    if (!notification)
      throw new NotFoundException(`Notification ${id} not found`);
    return notification;
  }
}
