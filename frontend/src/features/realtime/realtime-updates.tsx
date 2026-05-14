"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSessionSnapshot } from "@/lib/auth-session";
import {
  applyRealtimeNotificationToCache,
  markAllNotificationsReadInCache,
  markNotificationsReadInCache,
  setUnreadNotificationCount,
} from "@/lib/notification-cache";
import {
  connectRealtimeUpdates,
  type RealtimeDomainEvent,
} from "@/lib/realtime-socket";
import { usePaymentStore } from "@/store/payment-store";

export function RealtimeUpdates() {
  const authSession = useAuthSessionSnapshot();
  const queryClient = useQueryClient();
  const updatePaymentStatus = usePaymentStore(
    (state) => state.updatePaymentStatus,
  );
  const user = authSession?.user;

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return connectRealtimeUpdates(user, {
      onNotification: (payload) => {
        applyRealtimeNotificationToCache(queryClient, user, payload);
      },
      onUnreadCount: (payload) => {
        setUnreadNotificationCount(queryClient, user.id, payload.unreadCount);
      },
      onNotificationRead: (payload) => {
        markNotificationsReadInCache(queryClient, user.id, [
          payload.notificationId,
        ]);
      },
      onAllNotificationsRead: () => {
        markAllNotificationsReadInCache(queryClient, user.id);
      },
      onPaymentStatus: (event) => {
        updatePaymentStatus(event.sessionId, event);
      },
      onDomainEvent: (event) => {
        invalidateDomainQueries(queryClient, event);
      },
    });
  }, [queryClient, updatePaymentStatus, user]);

  return null;
}

function invalidateDomainQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  event: RealtimeDomainEvent,
) {
  if (event.entity === "notification") {
    return;
  }

  void queryClient.invalidateQueries({ queryKey: ["overview"] });
  void queryClient.invalidateQueries({ queryKey: ["audit-events"] });

  if (event.entity === "payment" || event.entity === "balance") {
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    void queryClient.invalidateQueries({ queryKey: ["report-transactions"] });
    void queryClient.invalidateQueries({
      queryKey: ["report-transactions-infinite"],
    });
    void queryClient.invalidateQueries({ queryKey: ["customer-report"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["customers-table"] });
    return;
  }

  if (event.entity === "service_request") {
    void queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-report"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["customers-table"] });
    return;
  }

  if (
    event.entity === "customer" ||
    event.entity === "primary_msisdn" ||
    event.entity === "secondary_msisdn"
  ) {
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["customers-table"] });
    void queryClient.invalidateQueries({ queryKey: ["customer-report"] });
    void queryClient.invalidateQueries({ queryKey: ["secondary-numbers"] });

    if (event.customerId) {
      void queryClient.invalidateQueries({
        queryKey: ["customer", event.customerId],
      });
    }

    return;
  }

  if (event.entity === "bundle") {
    void queryClient.invalidateQueries({ queryKey: ["bundles"] });
    void queryClient.invalidateQueries({ queryKey: ["bundle-packages"] });
  }
}
