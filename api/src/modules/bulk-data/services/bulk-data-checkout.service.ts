import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BulkPaymentSessionsRepository,
  BulkTransactionsRepository,
} from '../repositories';
import { buildApiUrl, escapeHtml } from './bulk-data-payment-url';

@Injectable()
export class BulkDataCheckoutService {
  constructor(
    private readonly paymentSessions: BulkPaymentSessionsRepository,
    private readonly transactions: BulkTransactionsRepository,
  ) {}

  async renderMockProviderCheckout(sessionId: string): Promise<string> {
    const session = await this.paymentSessions.findById(sessionId);

    if (!session) {
      throw new NotFoundException('Payment session not found');
    }

    const transaction = await this.transactions.findById(session.transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const payload = {
      sessionId: session.id,
      transactionId: session.transactionId,
      amount: Number(session.amountUgx).toLocaleString('en-US'),
      currency: session.currency,
      bundleName: transaction.bundleName,
      callbackUrl: buildApiUrl('/api/payments/callback'),
    };

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Card checkout</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f5f5f2; color: #171717; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
    section { width: min(100%, 420px); background: #ffffff; border: 1px solid #deded8; border-radius: 8px; box-shadow: 0 20px 50px rgb(23 23 23 / 12%); overflow: hidden; }
    header { background: #ffcc08; color: #111111; padding: 18px 20px; }
    h1 { margin: 0; font-size: 20px; line-height: 1.2; }
    form { display: grid; gap: 14px; padding: 20px; }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
    input { min-height: 40px; border: 1px solid #cfcfc8; border-radius: 6px; padding: 8px 10px; font: inherit; }
    .summary { display: grid; gap: 6px; border: 1px solid #ecece6; background: #fafaf7; border-radius: 6px; padding: 12px; font-size: 14px; }
    .amount { font-size: 24px; font-weight: 750; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
    button { min-height: 42px; border: 0; border-radius: 6px; font: inherit; font-weight: 700; cursor: pointer; }
    button[type="submit"] { background: #111111; color: #ffffff; }
    button[type="button"] { background: #eeeeea; color: #171717; }
    output { min-height: 20px; color: #52524d; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <section>
      <header><h1>Card checkout</h1></header>
      <form id="checkout-form">
        <div class="summary">
          <span>${escapeHtml(transaction.bundleName)}</span>
          <span class="amount">${session.currency} ${Number(session.amountUgx).toLocaleString('en-US')}</span>
        </div>
        <label>Card number<input inputmode="numeric" autocomplete="cc-number" value="4111 1111 1111 1111" /></label>
        <label>Name on card<input autocomplete="cc-name" value="Wholesale Customer" /></label>
        <div class="actions">
          <button type="button" id="decline-button">Decline</button>
          <button type="submit">Pay</button>
        </div>
        <output id="status-output">Waiting for card details.</output>
      </form>
    </section>
  </main>
  <script>
    const payment = ${JSON.stringify(payload)};
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("returnUrl");
    const output = document.getElementById("status-output");
    async function sendStatus(status) {
      output.textContent = status === "confirmed" ? "Submitting payment..." : "Declining payment...";
      const response = await fetch(payment.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: payment.sessionId,
          transactionId: payment.transactionId,
          status,
          receiptNumber: status === "confirmed" ? "RCT-" + Date.now().toString(36).toUpperCase() : undefined,
          failureReason: status === "failed" ? "Card payment declined in mock checkout." : undefined
        })
      });
      if (!response.ok) {
        output.textContent = "Payment update failed.";
        return;
      }
      output.textContent = status === "confirmed" ? "Payment approved." : "Payment declined.";
      if (returnUrl) {
        setTimeout(() => window.location.assign(returnUrl), 900);
      }
    }
    document.getElementById("checkout-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void sendStatus("confirmed");
    });
    document.getElementById("decline-button").addEventListener("click", () => {
      void sendStatus("failed");
    });
  </script>
</body>
</html>`;
  }
}
