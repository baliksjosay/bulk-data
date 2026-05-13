import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../../redis/redis.service';
import { HealthCheckService } from '../../health/health-check.service';

type PaymentStatus = 'awaiting_payment' | 'processing' | 'confirmed' | 'failed' | 'expired';

type PaymentStatusPayload = {
  sessionId: string;
  transactionId: string;
  status: PaymentStatus;
  message: string;
  provider?: string;
  receiptNumber?: string;
  paidAt?: string;
  socketEvent?: string;
  socketRoom?: string;
};

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      process.env.FRONTEND_URL || 'http://localhost:3001',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WebsocketGateway.name);

  private readonly MAX_LOGS = 20000;
  private redisPubClient: Redis;
  private redisSubClient: Redis;

  // ✅ Track authenticated users for notifications
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async afterInit() {
    this.logger.log('✅ WebSocket server initializing...');

    // --- Redis adapter setup ---
    this.redisPubClient = this.redis.getClient().duplicate();
    this.redisSubClient = this.redisPubClient.duplicate();

    this.server.adapter(
      createAdapter(this.redisPubClient, this.redisSubClient),
    );

    this.logger.log('✅ Redis adapter initialized for Socket.IO');
  }

  // ==================== JOB LOGS FEATURES ====================

  /** Broadcast to all clients in a given room */
  broadcastToRoom(sessionId: string, event: string, payload: any) {
    const room = `job:${sessionId}`;
    this.logger.log(
      `📢 Broadcasting ${event} to ${room}: ${JSON.stringify(payload)}`,
    );
    this.server.to(room).emit(event, payload);
  }

  /** Broadcast globally to everyone */
  broadcastAll(event: string, payload: any) {
    this.logger.log(`🌐 Broadcasting ${event} to all clients`);
    this.server.emit(event, payload);
  }

  async pushLog(sessionId: string, message: string) {
    const payload = {
      sessionId,
      message,
      timestamp: new Date().toISOString(),
    };

    // Save logs
    await this.redis.lpush(`logs:${sessionId}`, payload);
    await this.redis.ltrim(`logs:${sessionId}`, 0, this.MAX_LOGS - 1);

    // Broadcast to session room
    this.server.to(`job:${sessionId}`).emit('job-log', payload);
  }

  @SubscribeMessage('subscribe-job')
  async handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;

    if (!sessionId) {
      client.emit('job-room-unavailable', { reason: 'Missing sessionId' });
      return;
    }

    const room = `job:${sessionId}`;
    client.join(room);

    // ✅ Track room in Redis
    await this.redis.sadd('active:jobs', sessionId);

    this.logger.log(`Client ${client.id} subscribed to ${room}`);
    client.emit('subscribed', {
      sessionId,
      message: `You are now subscribed to logs for session ${sessionId}`,
    });

    // Replay logs
    const logs = await this.redis.lrange<any>(`logs:${sessionId}`, 0, -1);
    logs.toReversed().forEach((log) => {
      client.emit('job-log', log);
    });
  }

  @SubscribeMessage('unsubscribe-job')
  async handleUnsubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `job:${data.sessionId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);

    // ✅ Optionally clean up Redis if no one is in the room
    const sockets = await this.server.in(room).fetchSockets();
    if (sockets.length === 0) {
      await this.redis.srem('active:jobs', data.sessionId);
      this.logger.log(
        `No more subscribers, removed ${data.sessionId} from active jobs`,
      );
    }
  }

  /** Return all active sessionIds (shared across all workers) */
  async getActiveSessions(): Promise<string[]> {
    return await this.redis.smembers('active:jobs');
  }

  @SubscribeMessage('get-system-info')
  async handleSystemInfoRequest(@ConnectedSocket() client: Socket) {
    const system = await this.healthCheckService.getSystemInfo({
      includeMemoryDetails: true,
    });
    client.emit('system-info', system);
  }

  // ==================== PAYMENT STATUS FEATURES ====================

  @SubscribeMessage('payment:subscribe')
  handlePaymentSubscribe(
    @MessageBody()
    data: { room?: string; sessionId?: string; transactionId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = String(data?.sessionId ?? '').trim();
    const transactionId = String(data?.transactionId ?? '').trim();
    const room = String(data?.room ?? `payments:${sessionId}`).trim();

    if (!sessionId || !transactionId || room !== `payments:${sessionId}`) {
      client.emit('payment:error', {
        sessionId,
        transactionId,
        message: 'Invalid payment subscription',
      });

      return { success: false, error: 'Invalid payment subscription' };
    }

    client.join(room);
    client.emit('payment:subscribed', { sessionId, transactionId, room });
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);

    return { success: true, sessionId, transactionId, room };
  }

  emitPaymentStatus(payload: PaymentStatusPayload): void {
    const room = payload.socketRoom ?? `payments:${payload.sessionId}`;
    const eventName = payload.socketEvent ?? 'payment.status';
    const statusPayload = {
      sessionId: payload.sessionId,
      transactionId: payload.transactionId,
      status: payload.status,
      message: payload.message,
      provider: payload.provider,
      receiptNumber: payload.receiptNumber,
      paidAt: payload.paidAt,
    };

    this.server.to(room).emit('payment.status', statusPayload);

    if (eventName !== 'payment.status') {
      this.server.to(room).emit(eventName, statusPayload);
    }

    this.logger.debug(
      `Payment status ${payload.status} emitted to ${room} for session ${payload.sessionId}`,
    );
  }

  @Interval(5000)
  async broadcastSystemInfo() {
    const system = await this.healthCheckService.getSystemInfo({
      includeMemoryDetails: true,
    });
    const database = await this.healthCheckService.getDatabaseHealth();
    system.database = database;
    this.server.emit('system-info', system);
  }

  // ==================== NOTIFICATIONS FEATURES ====================
  /**
   * Broadcast notification to all connected users
   */
  broadcastNotification(notification: any): void {
    this.server.emit('system_notification', notification);
    this.logger.log('Broadcast system notification to all users');
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  /**
   * Get online user count
   */
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  // ==================== CONNECTION HANDLERS ====================

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Try to authenticate for notifications
    await this.authenticateAndJoinNotifications(client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up user socket mapping
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
  }

  private getNotificationRoom(userId: string): string {
    return `notifications:${userId}`;
  }

  private async authenticateAndJoinNotifications(
    client: Socket,
  ): Promise<string | null> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return null;
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = String(payload.sub);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      client.join(this.getNotificationRoom(userId));

      if (userId) {
        client.join(this.getNotificationRoom(userId));
        client.data.userId = userId;
      }

      client.data.userId = userId;

      this.logger.log(`User ${userId} authenticated for notifications`);
      return userId;
    } catch (error) {
      this.logger.error(`Authentication error: ${error?.message}`);
      return null;
    }
  }

  @SubscribeMessage('subscribe_notifications')
  async handleSubscribeNotifications(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      const authenticatedUserId =
        await this.authenticateAndJoinNotifications(client);

      if (!authenticatedUserId) {
        return { success: false, error: 'Authentication required' };
      }
    }

    this.logger.debug(`User ${client.data.userId} subscribed to notifications`);
    return { success: true, message: 'Subscribed to notifications' };
  }

  @SubscribeMessage('get_unread_count')
  async handleGetUnreadCount(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const count =
        (await this.redis.get<number>(`notifications:unread:${userId}`)) ?? 0;

      return { success: true, count };
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error?.message}`);
      return { success: false, error: error?.message };
    }
  }

  sendNotificationToUser(userId: string, notification: any): void {
    this.server
      .to(this.getNotificationRoom(userId))
      .emit('notification:new', notification);

    this.logger.debug(`Sent notification to user ${userId}`);
  }

  async sendUnreadCountUpdate(userId: string, count: number): Promise<void> {
    await this.redis.set(`notifications:unread:${userId}`, count);

    this.server
      .to(this.getNotificationRoom(userId))
      .emit('notification:unread-count', { unreadCount: count });

    this.logger.debug(`Sent unread count update to user ${userId}: ${count}`);
  }

  sendNotificationRead(userId: string, notificationId: string): void {
    this.server
      .to(this.getNotificationRoom(userId))
      .emit('notification:read', { notificationId });
  }

  sendAllNotificationsRead(userId: string): void {
    this.server
      .to(this.getNotificationRoom(userId))
      .emit('notification:all-read', {});
  }

  sendNotificationDeleted(userId: string, notificationId: string): void {
    this.server
      .to(this.getNotificationRoom(userId))
      .emit('notification:deleted', { notificationId });
  }

  sendToGroupUsers(userId: string, event: string, payload: any): void {
    this.server.to(this.getNotificationRoom(userId)).emit(event, payload);
  }

  broadcastSystemNotification(notification: any): void {
    this.server.emit('system:notification', notification);
  }
}
