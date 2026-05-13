import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from 'src/modules/notifications/services/notification-websocket.service';
import { PaymentMethod, PaymentSessionStatus } from '../dto/bulk-data.dto';
import { BulkPaymentSessionEntity } from '../entities';

type PaymentAdvanceHandler = (
  sessionId: string,
  status: PaymentSessionStatus.PROCESSING | PaymentSessionStatus.CONFIRMED,
  message: string,
) => void;

@Injectable()
export class BulkDataPaymentEventsService {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  emitPaymentStatus(
    session: BulkPaymentSessionEntity,
    status: PaymentSessionStatus,
    message: string,
    receiptNumber?: string,
  ) {
    this.websocketGateway.emitPaymentStatus({
      sessionId: session.id,
      transactionId: session.transactionId,
      status,
      message,
      provider: session.provider,
      receiptNumber:
        receiptNumber ??
        (status === PaymentSessionStatus.CONFIRMED
          ? `RCT-${Date.now().toString(36).toUpperCase()}`
          : undefined),
      paidAt:
        status === PaymentSessionStatus.CONFIRMED
          ? new Date().toISOString()
          : undefined,
      socketEvent: session.socketEvent,
      socketRoom: session.socketRoom,
    });
  }

  schedulePaymentStatusSimulation(
    session: BulkPaymentSessionEntity,
    onAdvance: PaymentAdvanceHandler,
  ) {
    if (process.env.SIMULATE_PAYMENT_STATUS_UPDATES !== 'true') {
      return;
    }

    setTimeout(() => {
      onAdvance(
        session.id,
        PaymentSessionStatus.PROCESSING,
        'Payment instruction received by provider.',
      );
    }, 1200);

    if (session.paymentMethod === PaymentMethod.CARD) {
      return;
    }

    setTimeout(
      () => {
        onAdvance(
          session.id,
          PaymentSessionStatus.CONFIRMED,
          'Payment confirmed by provider.',
        );
      },
      session.paymentMethod === PaymentMethod.PRN ? 6200 : 4600,
    );
  }
}
