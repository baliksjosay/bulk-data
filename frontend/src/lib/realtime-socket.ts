"use client";

import { io, type Socket } from "socket.io-client";
import type {
  AuthenticatedUser,
  InAppNotification,
  PaymentStatusEvent,
  PaymentStatus,
} from "@/types/domain";

export type RealtimeDomainEntity =
  | "notification"
  | "payment"
  | "service_request"
  | "customer"
  | "primary_msisdn"
  | "secondary_msisdn"
  | "bundle"
  | "balance";

export type RealtimeDomainAction =
  | "created"
  | "updated"
  | "status_changed"
  | "converted"
  | "processing"
  | "confirmed"
  | "failed"
  | "expired"
  | "provisioned"
  | "removed"
  | "awaiting_payment";

export interface RealtimeDomainEvent {
  entity: RealtimeDomainEntity;
  action: RealtimeDomainAction;
  entityId?: string;
  userId?: string;
  customerId?: string;
  transactionId?: string;
  paymentSessionId?: string;
  status?: string;
  message: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface RealtimeNotificationPayload {
  deliveryId?: string;
  notificationId?: string;
  notification?: InAppNotification;
  channel?: string;
  subject?: string | null;
  body?: string;
  htmlBody?: string | null;
  data?: Record<string, unknown>;
  timestamp?: string;
  unreadCount?: number;
}

export interface RealtimeUnreadCountPayload {
  unreadCount: number;
}

interface RealtimeHandlers {
  onNotification?: (payload: RealtimeNotificationPayload) => void;
  onUnreadCount?: (payload: RealtimeUnreadCountPayload) => void;
  onNotificationRead?: (payload: { notificationId: string }) => void;
  onAllNotificationsRead?: () => void;
  onDomainEvent?: (event: RealtimeDomainEvent) => void;
  onPaymentStatus?: (event: PaymentStatusEvent) => void;
  onError?: (message: string) => void;
}

function resolveRealtimeSocketUrl() {
  return (
    process.env.NEXT_PUBLIC_NOTIFICATION_SOCKET_URL?.trim() ||
    process.env.NEXT_PUBLIC_PAYMENT_SOCKET_URL?.trim()
  );
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    value === "awaiting_payment" ||
    value === "processing" ||
    value === "confirmed" ||
    value === "failed" ||
    value === "expired"
  );
}

function normalizePaymentStatusEvent(
  event: RealtimeDomainEvent,
): PaymentStatusEvent | null {
  if (
    event.entity !== "payment" ||
    !event.paymentSessionId ||
    !event.transactionId ||
    !isPaymentStatus(event.status)
  ) {
    return null;
  }

  return {
    sessionId: event.paymentSessionId,
    transactionId: event.transactionId,
    status: event.status,
    message: event.message,
  };
}

export function connectRealtimeUpdates(
  user: AuthenticatedUser,
  handlers: RealtimeHandlers,
) {
  const apiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "fake";
  const socketUrl = resolveRealtimeSocketUrl();

  if (apiMode !== "live") {
    return () => undefined;
  }

  if (!socketUrl) {
    handlers.onError?.("Realtime socket URL is not configured.");
    return () => undefined;
  }

  let socket: Socket | null = io(socketUrl, {
    auth: { userId: user.id },
    transports: ["websocket"],
    withCredentials: true,
  });

  const handleConnectError = (error: Error | { message?: string }) => {
    handlers.onError?.(error.message || "Realtime connection failed.");
  };
  const handleDomainEvent = (event: RealtimeDomainEvent) => {
    handlers.onDomainEvent?.(event);

    const paymentEvent = normalizePaymentStatusEvent(event);

    if (paymentEvent) {
      handlers.onPaymentStatus?.(paymentEvent);
    }
  };

  socket.on("connect", () => {
    socket?.emit(
      "subscribe_notifications",
      (response?: { success?: boolean; error?: string }) => {
        if (response?.success === false) {
          handlers.onError?.(
            response.error || "Realtime notification subscription failed.",
          );
        }
      },
    );
  });
  socket.on("notification:new", handlers.onNotification ?? (() => undefined));
  socket.on(
    "notification:unread-count",
    handlers.onUnreadCount ?? (() => undefined),
  );
  socket.on(
    "notification:read",
    handlers.onNotificationRead ?? (() => undefined),
  );
  socket.on(
    "notification:all-read",
    handlers.onAllNotificationsRead ?? (() => undefined),
  );
  socket.on("bulk-data:event", handleDomainEvent);
  socket.on("payment.status", handlers.onPaymentStatus ?? (() => undefined));
  socket.on("connect_error", handleConnectError);

  return () => {
    socket?.off("bulk-data:event", handleDomainEvent);
    socket?.off("connect_error", handleConnectError);
    socket?.disconnect();
    socket = null;
  };
}
