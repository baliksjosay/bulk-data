"use client";

import type { QueryClient } from "@tanstack/react-query";
import type {
  AuthenticatedUser,
  InAppNotification,
  NotificationListResult,
  NotificationUnreadCount,
} from "@/types/domain";
import type { RealtimeNotificationPayload } from "@/lib/realtime-socket";

const notificationListKey = (userId: string) => ["notifications", userId] as const;
const unreadCountKey = (userId: string) =>
  ["notifications-unread-count", userId] as const;

export function applyRealtimeNotificationToCache(
  queryClient: QueryClient,
  user: AuthenticatedUser,
  payload: RealtimeNotificationPayload,
) {
  const notification =
    payload.notification ?? buildNotificationFromRealtimePayload(user, payload);

  upsertNotification(queryClient, user.id, notification);

  if (typeof payload.unreadCount === "number") {
    setUnreadNotificationCount(queryClient, user.id, payload.unreadCount);
    return;
  }

  incrementUnreadNotificationCount(queryClient, user.id);
}

export function setUnreadNotificationCount(
  queryClient: QueryClient,
  userId: string,
  count: number,
) {
  queryClient.setQueryData<NotificationUnreadCount>(unreadCountKey(userId), {
    count: Math.max(0, count),
  });
}

export function markNotificationsReadInCache(
  queryClient: QueryClient,
  userId: string,
  notificationIds: string[],
  unreadDelta = 0,
) {
  if (!notificationIds.length) {
    return;
  }

  const idSet = new Set(notificationIds);
  const now = new Date().toISOString();

  queryClient.setQueriesData<NotificationListResult>(
    { queryKey: notificationListKey(userId) },
    (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        data: current.data.map((item) =>
          idSet.has(item.id) || idSet.has(item.notificationId)
            ? {
                ...item,
                isRead: true,
                status: "read",
                readAt: item.readAt ?? now,
                updatedAt: now,
              }
            : item,
        ),
      };
    },
  );

  if (unreadDelta > 0) {
    decrementUnreadNotificationCount(queryClient, userId, unreadDelta);
  }
}

export function markAllNotificationsReadInCache(
  queryClient: QueryClient,
  userId: string,
) {
  const now = new Date().toISOString();

  queryClient.setQueriesData<NotificationListResult>(
    { queryKey: notificationListKey(userId) },
    (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        data: current.data.map((item) => ({
          ...item,
          isRead: true,
          status: "read",
          readAt: item.readAt ?? now,
          updatedAt: now,
        })),
      };
    },
  );
  setUnreadNotificationCount(queryClient, userId, 0);
}

function upsertNotification(
  queryClient: QueryClient,
  userId: string,
  notification: InAppNotification,
) {
  queryClient.setQueriesData<NotificationListResult>(
    { queryKey: notificationListKey(userId) },
    (current) => {
      if (!current) {
        return current;
      }

      const exists = current.data.some(
        (item) =>
          item.id === notification.id ||
          item.notificationId === notification.notificationId,
      );
      const existingRows = current.data.filter(
        (item) =>
          item.id !== notification.id &&
          item.notificationId !== notification.notificationId,
      );

      return {
        ...current,
        data: [notification, ...existingRows].slice(
          0,
          Math.max(current.data.length, 1),
        ),
        total: exists ? current.total : current.total + 1,
      };
    },
  );
}

function incrementUnreadNotificationCount(queryClient: QueryClient, userId: string) {
  queryClient.setQueryData<NotificationUnreadCount>(
    unreadCountKey(userId),
    (current) => ({ count: (current?.count ?? 0) + 1 }),
  );
}

function decrementUnreadNotificationCount(
  queryClient: QueryClient,
  userId: string,
  amount: number,
) {
  queryClient.setQueryData<NotificationUnreadCount>(
    unreadCountKey(userId),
    (current) => ({ count: Math.max(0, (current?.count ?? 0) - amount) }),
  );
}

function buildNotificationFromRealtimePayload(
  user: AuthenticatedUser,
  payload: RealtimeNotificationPayload,
): InAppNotification {
  const generatedId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `notification-${Date.now().toString(36)}`;
  const notificationId =
    payload.notificationId ?? payload.deliveryId ?? generatedId;
  const createdAt = payload.timestamp ?? new Date().toISOString();
  const subject = payload.subject ?? "Notification";

  return {
    id: payload.deliveryId ?? notificationId,
    notificationId,
    userId: user.id,
    email: user.email,
    phoneNumber: null,
    isRead: false,
    status: "sent",
    readAt: null,
    dismissedAt: null,
    createdAt,
    updatedAt: createdAt,
    notification: {
      id: notificationId,
      type: "system_alert",
      status: "sent",
      priority: "normal",
      subject,
      body: payload.body ?? subject,
      data: payload.data ?? null,
      actionUrl: null,
      actionLabel: null,
      createdAt,
      updatedAt: createdAt,
    },
  };
}
