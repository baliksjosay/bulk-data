"use client";

import { create } from "zustand";
import type { PaymentStatusEvent, PurchaseResult } from "@/types/domain";

export interface TrackedPayment {
  id: string;
  result: PurchaseResult;
  customerName: string;
  bundleName: string;
  primaryMsisdn: string;
  startedAt: string;
  event?: PaymentStatusEvent;
  errorMessage?: string;
  finalized: boolean;
  dismissed: boolean;
}

interface TrackPaymentInput {
  result: PurchaseResult;
  customerName: string;
  bundleName: string;
  primaryMsisdn: string;
}

interface PaymentState {
  payments: TrackedPayment[];
  trackPayment: (payment: TrackPaymentInput) => void;
  updatePaymentStatus: (sessionId: string, event: PaymentStatusEvent) => void;
  setPaymentError: (sessionId: string, errorMessage: string) => void;
  markPaymentFinalized: (sessionId: string) => void;
  dismissPayment: (sessionId: string) => void;
  removePayment: (sessionId: string) => void;
}

function isTerminalStatus(status: PaymentStatusEvent["status"]) {
  return status === "confirmed" || status === "failed" || status === "expired";
}

export const usePaymentStore = create<PaymentState>()((set) => ({
  payments: [],
  trackPayment: ({ result, customerName, bundleName, primaryMsisdn }) =>
    set((state) => {
      const id = result.paymentSession.id;
      const payment: TrackedPayment = {
        id,
        result,
        customerName,
        bundleName,
        primaryMsisdn,
        startedAt: new Date().toISOString(),
        finalized: false,
        dismissed: false,
      };

      return {
        payments: [payment, ...state.payments.filter((item) => item.id !== id)].slice(0, 5),
      };
    }),
  updatePaymentStatus: (sessionId, event) =>
    set((state) => ({
      payments: state.payments.map((payment) =>
        payment.id === sessionId
          ? {
              ...payment,
              event,
              errorMessage: "",
              dismissed: isTerminalStatus(event.status) ? false : payment.dismissed,
            }
          : payment,
      ),
    })),
  setPaymentError: (sessionId, errorMessage) =>
    set((state) => ({
      payments: state.payments.map((payment) =>
        payment.id === sessionId
          ? {
              ...payment,
              errorMessage,
              dismissed: false,
            }
          : payment,
      ),
    })),
  markPaymentFinalized: (sessionId) =>
    set((state) => ({
      payments: state.payments.map((payment) =>
        payment.id === sessionId
          ? {
              ...payment,
              finalized: true,
              dismissed: false,
            }
          : payment,
      ),
    })),
  dismissPayment: (sessionId) =>
    set((state) => ({
      payments: state.payments.map((payment) =>
        payment.id === sessionId
          ? {
              ...payment,
              dismissed: true,
            }
          : payment,
      ),
    })),
  removePayment: (sessionId) =>
    set((state) => ({
      payments: state.payments.filter((payment) => payment.id !== sessionId),
    })),
}));
