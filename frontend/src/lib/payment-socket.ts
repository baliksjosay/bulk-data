"use client";

import { io, type Socket } from "socket.io-client";
import type { PaymentSession, PaymentStatusEvent } from "@/types/domain";

interface PaymentStatusSubscription {
  onStatus: (event: PaymentStatusEvent) => void;
  onError?: (message: string) => void;
}

function makeStatusEvent(
  session: PaymentSession,
  status: PaymentStatusEvent["status"],
  message: string,
): PaymentStatusEvent {
  return {
    sessionId: session.id,
    transactionId: session.transactionId,
    status,
    message,
    provider: session.provider,
    receiptNumber: status === "confirmed" ? `RCT-${Date.now().toString(36).toUpperCase()}` : undefined,
    paidAt: status === "confirmed" ? new Date().toISOString() : undefined,
  };
}

function subscribeToFakePaymentStatus(session: PaymentSession, handlers: PaymentStatusSubscription) {
  const timers = [
    window.setTimeout(() => {
      handlers.onStatus(makeStatusEvent(session, "processing", "Payment instruction received."));
    }, 1200),
    window.setTimeout(() => {
      handlers.onStatus(makeStatusEvent(session, "confirmed", "Payment confirmed by provider."));
    }, session.paymentMethod === "prn" ? 6200 : 4600),
  ];

  handlers.onStatus(makeStatusEvent(session, "awaiting_payment", "Listening for payment confirmation."));

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}

export function subscribeToPaymentStatus(
  session: PaymentSession,
  handlers: PaymentStatusSubscription,
) {
  const apiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "fake";
  const socketUrl = process.env.NEXT_PUBLIC_PAYMENT_SOCKET_URL?.trim();

  if (apiMode !== "live") {
    return subscribeToFakePaymentStatus(session, handlers);
  }

  handlers.onStatus(makeStatusEvent(session, session.status, "Listening for payment confirmation."));

  if (!socketUrl) {
    handlers.onError?.("Payment status WebSocket URL is not configured.");
    return () => undefined;
  }

  let socket: Socket | null = io(socketUrl, {
    auth: {
      sessionId: session.id,
      transactionId: session.transactionId,
    },
    transports: ["websocket"],
  });

  const handleSocketError = (error: Error | { message?: string }) => {
    handlers.onError?.(error.message || "Payment status connection failed.");
  };
  const handleStatus = (event: PaymentStatusEvent) => {
    if (event.sessionId === session.id || event.transactionId === session.transactionId) {
      handlers.onStatus(event);
    }
  };

  socket.on("connect", () => {
    socket?.emit("payment:subscribe", {
      room: session.socketRoom,
      sessionId: session.id,
      transactionId: session.transactionId,
    }, (response?: { success?: boolean; error?: string }) => {
      if (response && response.success === false) {
        handlers.onError?.(response.error || "Payment status subscription failed.");
      }
    });
  });
  socket.on("payment.status", handleStatus);
  socket.on(session.socketEvent, handleStatus);
  socket.on("payment:error", handleSocketError);
  socket.on("connect_error", handleSocketError);

  return () => {
    socket?.off("payment.status", handleStatus);
    socket?.off(session.socketEvent, handleStatus);
    socket?.off("payment:error", handleSocketError);
    socket?.off("connect_error", handleSocketError);
    socket?.disconnect();
    socket = null;
  };
}
