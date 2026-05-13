import { api } from "@/lib/api-client";
import { formatDateTime, formatPaymentMethod, formatUgx, sentenceCase } from "@/lib/format";
import { useBundleInsightStore } from "@/store/bundle-insight-store";
import { usePaymentStore } from "@/store/payment-store";
import type { ReportTransaction, Transaction } from "@/types/domain";

type ReceiptTransaction = Transaction | ReportTransaction;

const mtnReceiptContacts = [
  ["Toll Free", "100"],
  ["Phone contact", "0771 001 000"],
  ["General Inquiries", "customerservice.ug@mtn.com"],
  ["Chat on Whatsapp", "+256 772 123 100"],
  ["Physical address", "Plot 69-71 Jinja Road; Kampala, Uganda"],
  ["Postal address", "P.O Box 24624 Kampala, Uganda"],
];

function normalizeFilename(filename: string) {
  return filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "download";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, "?");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resolveReceiptRows(transaction: ReceiptTransaction) {
  const rows = [
    ["Receipt ID", transaction.id],
    ["Customer", transaction.customerName],
    ["Primary MSISDN", transaction.primaryMsisdn],
    ["Bundle", transaction.bundleName],
    ["Payment method", formatPaymentMethod(transaction.paymentMethod)],
    ["Amount", formatUgx(transaction.amountUgx)],
    ["Status", sentenceCase(transaction.status)],
    ["Transaction date", formatDateTime(transaction.createdAt)],
  ];

  if ("registrationNumber" in transaction) {
    rows.splice(2, 0, ["Registration number", transaction.registrationNumber]);
  }

  if ("apnId" in transaction) {
    rows.splice(5, 0, ["APN", transaction.apnId]);
  }

  return rows;
}

function pdfObject(content: string) {
  return content;
}

function writePdfText(text: string, x: number, y: number, size: number, font = "F1") {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET\n`;
}

function truncatePdfText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, Math.max(maxLength - 3, 0))}...` : value;
}

function estimatePdfTextWidth(text: string, size: number) {
  return text.length * size * 0.52;
}

function writePdfRightText(text: string, rightX: number, y: number, size: number, font = "F1") {
  return writePdfText(text, rightX - estimatePdfTextWidth(text, size), y, size, font);
}

function drawPdfLine(x1: number, y1: number, x2: number, y2: number, color = "0.86 0.86 0.82") {
  return `${color} RG ${x1} ${y1} m ${x2} ${y2} l S\n`;
}

function drawPdfRect(x: number, y: number, width: number, height: number, color: string) {
  return `${color} rg ${x} ${y} ${width} ${height} re f\n`;
}

function drawPdfEllipsePath(x: number, y: number, width: number, height: number) {
  const kappa = 0.5522847498;
  const ox = (width / 2) * kappa;
  const oy = (height / 2) * kappa;
  const xe = x + width;
  const ye = y + height;
  const xm = x + width / 2;
  const ym = y + height / 2;

  return [
    `${xm} ${y} m`,
    `${xm + ox} ${y} ${xe} ${ym - oy} ${xe} ${ym} c`,
    `${xe} ${ym + oy} ${xm + ox} ${ye} ${xm} ${ye} c`,
    `${xm - ox} ${ye} ${x} ${ym + oy} ${x} ${ym} c`,
    `${x} ${ym - oy} ${xm - ox} ${y} ${xm} ${y} c`,
  ].join(" ");
}

function drawPdfMtnLogo(x: number, y: number) {
  return [
    drawPdfRect(x, y, 78, 38, "1 0.8 0"),
    "q 1.4 w 0.07 0.07 0.07 RG\n",
    `${drawPdfEllipsePath(x + 10, y + 8, 58, 22)} S\n`,
    "Q\n",
    "0.07 0.07 0.07 rg\n",
    writePdfText("MTN", x + 28, y + 19, 11, "F2"),
  ].join("");
}

function buildReceiptPdf(transaction: ReceiptTransaction) {
  const rows = resolveReceiptRows(transaction);
  const generatedAt = new Date().toLocaleString();
  const status = sentenceCase(transaction.status);
  const paymentMethod = formatPaymentMethod(transaction.paymentMethod);
  const serviceRef = "registrationNumber" in transaction ? transaction.registrationNumber : transaction.primaryMsisdn;
  const detailRows = rows.filter(
    ([label]) => !["Customer", "Bundle", "Payment method", "Amount", "Status"].includes(label),
  );
  const commands: string[] = [
    drawPdfRect(0, 0, 595, 842, "1 1 1"),
    drawPdfRect(0, 810, 595, 32, "1 0.8 0"),
    drawPdfMtnLogo(44, 748),
    "0.07 0.07 0.07 rg\n",
    writePdfText("MTN Uganda", 44, 724, 10, "F2"),
    writePdfText("Plot 69-71 Jinja Road, Kampala", 44, 710, 8),
    writePdfText("customerservice.ug@mtn.com | 100", 44, 698, 8),
    writePdfText("OFFICIAL RECEIPT", 404, 770, 18, "F2"),
    "0.36 0.36 0.36 rg\n",
    writePdfRightText(`Receipt No. ${transaction.id}`, 551, 746, 9, "F2"),
    writePdfRightText(`Issue date: ${generatedAt}`, 551, 732, 8),
    writePdfRightText(`Status: ${status}`, 551, 718, 8, "F2"),
    drawPdfLine(44, 682, 551, 682),
    "0.07 0.07 0.07 rg\n",
    writePdfText("BILL TO", 44, 660, 9, "F2"),
    writePdfText("PAYMENT SUMMARY", 346, 660, 9, "F2"),
    "0.36 0.36 0.36 rg\n",
    writePdfText(truncatePdfText(transaction.customerName, 42), 44, 642, 10, "F2"),
    writePdfText(`Primary MSISDN: ${transaction.primaryMsisdn}`, 44, 626, 8),
    writePdfText(`Reference: ${serviceRef}`, 44, 612, 8),
    drawPdfRect(346, 618, 205, 44, "0.07 0.07 0.07"),
    "1 0.8 0 rg\n",
    writePdfText(formatUgx(transaction.amountUgx), 360, 638, 16, "F2"),
    "1 1 1 rg\n",
    writePdfRightText(paymentMethod, 537, 638, 9, "F2"),
    drawPdfLine(44, 586, 551, 586),
    "0.07 0.07 0.07 rg\n",
    writePdfText("LINE ITEM", 44, 564, 9, "F2"),
    drawPdfRect(44, 532, 507, 22, "0.95 0.95 0.92"),
    "0.07 0.07 0.07 rg\n",
    writePdfText("Description", 54, 539, 8, "F2"),
    writePdfText("Reference", 296, 539, 8, "F2"),
    writePdfRightText("Amount", 538, 539, 8, "F2"),
    drawPdfLine(44, 532, 551, 532),
    writePdfText(truncatePdfText(transaction.bundleName, 42), 54, 512, 9),
    writePdfText(truncatePdfText(transaction.primaryMsisdn, 22), 296, 512, 9),
    writePdfRightText(formatUgx(transaction.amountUgx), 538, 512, 9, "F2"),
    drawPdfLine(44, 496, 551, 496),
    writePdfRightText("Total paid", 456, 474, 9, "F2"),
    writePdfRightText(formatUgx(transaction.amountUgx), 538, 474, 11, "F2"),
    drawPdfLine(44, 450, 551, 450),
    "0.07 0.07 0.07 rg\n",
    writePdfText("TRANSACTION DETAILS", 44, 428, 9, "F2"),
  ];

  const rowY = 408;

  detailRows.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 44 : 300;
    const y = rowY - Math.floor(index / 2) * 34;

    commands.push("0.36 0.36 0.36 rg\n");
    commands.push(writePdfText(label, x, y, 7, "F2"));
    commands.push("0.07 0.07 0.07 rg\n");
    commands.push(writePdfText(truncatePdfText(value, 36), x, y - 13, 8));
  });

  commands.push(drawPdfRect(44, 126, 507, 68, "0.98 0.97 0.93"));
  commands.push("0.07 0.07 0.07 rg\n");
  commands.push(writePdfText("SUPPORT", 58, 172, 8, "F2"));
  commands.push(writePdfText("Toll Free: 100", 58, 154, 8));
  commands.push(writePdfText("Phone: 0771 001 000", 210, 154, 8));
  commands.push(writePdfText("WhatsApp: +256 772 123 100", 382, 154, 8));
  commands.push(writePdfText("customerservice.ug@mtn.com", 58, 138, 8));
  commands.push(writePdfText("Plot 69-71 Jinja Road; P.O Box 24624 Kampala, Uganda", 260, 138, 8));
  commands.push(drawPdfRect(44, 84, 507, 2, "1 0.8 0"));
  commands.push("0.36 0.36 0.36 rg\n");
  commands.push(writePdfText("This computer-generated receipt is valid without a signature.", 44, 62, 8));
  commands.push(writePdfText("Thank you for using MTN Bulk Data Wholesale Service.", 44, 48, 8, "F2"));

  const stream = commands.join("");
  const objects = [
    pdfObject("<< /Type /Catalog /Pages 2 0 R >>"),
    pdfObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    pdfObject(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    ),
    pdfObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    pdfObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    pdfObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`),
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([body], { type: "application/pdf" });
}

function buildReceiptPreviewHtml(transaction: ReceiptTransaction, pdfUrl: string, pdfFilename: string) {
  const generatedAt = new Date().toLocaleString();
  const logoUrl = `${window.location.origin}/logos/mtn-logo-black.svg`;
  const receiptRows = resolveReceiptRows(transaction);
  const rowsMarkup = receiptRows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const contactMarkup = mtnReceiptContacts
    .map(
      ([label, value]) => `
        <div class="contact-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(transaction.id)}</title>
    <style>
      :root {
        color-scheme: light;
        --mtn-yellow: #ffcc00;
        --ink: #111111;
        --muted: #666b73;
        --line: #e8e5d7;
        --paper: #fffdf4;
      }

      * { box-sizing: border-box; }
      body {
        background: #f4f2e8;
        color: var(--ink);
        font-family: "Outfit", "MTNWorkSans", "Work Sans", Arial, sans-serif;
        margin: 0;
        padding: 16px;
      }
      .toolbar {
        align-items: center;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin: 0 auto 12px;
        max-width: 760px;
      }
      .button {
        align-items: center;
        border: 1px solid rgba(17, 17, 17, 0.14);
        border-radius: 8px;
        color: var(--ink);
        cursor: pointer;
        display: inline-flex;
        font-size: 13px;
        font-weight: 700;
        justify-content: center;
        min-height: 38px;
        padding: 9px 14px;
        text-decoration: none;
      }
      .button.primary {
        background: var(--mtn-yellow);
        border-color: var(--mtn-yellow);
      }
      .button.secondary { background: #ffffff; }
      .receipt {
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 10px;
        box-shadow: 0 18px 56px rgba(17, 17, 17, 0.1);
        margin: 0 auto;
        max-width: 760px;
        overflow: hidden;
      }
      .brand-band {
        background: var(--mtn-yellow);
        display: grid;
        gap: 16px;
        grid-template-columns: 1fr auto;
        padding: 18px 24px;
      }
      .logo-box {
        align-items: center;
        background: #ffffff;
        border-radius: 8px;
        display: inline-flex;
        height: 42px;
        justify-content: center;
        padding: 8px 12px;
        width: 88px;
      }
      .logo-box img { display: block; max-height: 26px; max-width: 64px; }
      h1 {
        font-size: 22px;
        line-height: 1.1;
        margin: 12px 0 4px;
      }
      .subtitle {
        color: rgba(17, 17, 17, 0.72);
        font-size: 13px;
        margin: 0;
      }
      .receipt-id {
        align-self: start;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(17, 17, 17, 0.12);
        border-radius: 8px;
        min-width: 170px;
        padding: 10px;
        text-align: right;
      }
      .receipt-id span {
        color: rgba(17, 17, 17, 0.62);
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .receipt-id strong {
        display: block;
        font-size: 14px;
        margin-top: 4px;
      }
      .summary {
        background: var(--ink);
        color: #ffffff;
        display: grid;
        gap: 14px;
        grid-template-columns: 1.2fr 0.8fr 0.8fr;
        padding: 14px 24px;
      }
      .summary span {
        color: rgba(255, 255, 255, 0.64);
        display: block;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary strong {
        display: block;
        font-size: 14px;
        margin-top: 5px;
      }
      .summary .amount strong { color: var(--mtn-yellow); font-size: 22px; }
      .content { padding: 18px 24px 22px; }
      .section-title {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin: 0 0 8px;
        text-transform: uppercase;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border-bottom: 1px solid var(--line);
        font-size: 13px;
        padding: 8px 0;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: #000000;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        width: 190px;
      }
      tr:last-child th, tr:last-child td { border-bottom: 0; }
      .contacts {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        display: grid;
        gap: 0;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-top: 18px;
        overflow: hidden;
      }
      .contact-item {
        border-bottom: 1px solid var(--line);
        min-height: 54px;
        padding: 10px 12px;
      }
      .contact-item:nth-child(odd) { border-right: 1px solid var(--line); }
      .contact-item:nth-last-child(-n + 2) { border-bottom: 0; }
      .contact-item span {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .contact-item strong {
        display: block;
        font-size: 13px;
        line-height: 1.4;
      }
      .footer {
        color: var(--muted);
        font-size: 12px;
        margin-top: 16px;
      }

      @media (max-width: 720px) {
        body { padding: 10px; }
        .toolbar { flex-wrap: wrap; justify-content: stretch; }
        .button { flex: 1; }
	        .brand-band, .summary { grid-template-columns: 1fr; padding: 18px; }
        .receipt-id { text-align: left; }
	        .content { padding: 18px; }
        th { width: 140px; }
        .contacts { grid-template-columns: 1fr; }
        .contact-item, .contact-item:nth-child(odd) { border-right: 0; }
        .contact-item:nth-last-child(2) { border-bottom: 1px solid var(--line); }
      }

      @media print {
        body { background: #ffffff; padding: 0; }
        .toolbar { display: none; }
        .receipt {
          border: 0;
          border-radius: 0;
          box-shadow: none;
          max-width: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button class="button secondary" type="button" onclick="window.print()">Print</button>
      <a class="button primary" href="${pdfUrl}" download="${escapeHtml(pdfFilename)}">Download PDF</a>
    </div>
    <main class="receipt">
      <section class="brand-band">
        <div>
          <div class="logo-box"><img src="${logoUrl}" alt="MTN" /></div>
          <h1>Official Receipt</h1>
          <p class="subtitle">Official MTN Uganda transaction receipt generated ${escapeHtml(generatedAt)}</p>
        </div>
        <aside class="receipt-id">
          <span>Receipt ID</span>
          <strong>${escapeHtml(transaction.id)}</strong>
        </aside>
      </section>
      <section class="summary">
        <div class="amount">
          <span>Amount</span>
          <strong>${escapeHtml(formatUgx(transaction.amountUgx))}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>${escapeHtml(sentenceCase(transaction.status))}</strong>
        </div>
        <div>
          <span>Payment</span>
          <strong>${escapeHtml(formatPaymentMethod(transaction.paymentMethod))}</strong>
        </div>
      </section>
      <section class="content">
        <p class="section-title">Transaction details</p>
        <table>${rowsMarkup}</table>
        <p class="section-title" style="margin-top: 28px;">MTN Uganda support</p>
        <div class="contacts">${contactMarkup}</div>
        <p class="footer">This receipt confirms the bulk data wholesale transaction recorded in the MTN Bulk Data Wholesale Service console.</p>
      </section>
    </main>
  </body>
</html>`;
}

export async function showPrimaryBalance(customerId: string, primaryMsisdn: string) {
  const store = useBundleInsightStore.getState();

  store.openBalanceLoading(primaryMsisdn);

  try {
    const balance = await api.balance(customerId, primaryMsisdn);

    useBundleInsightStore.getState().showBalance(balance);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bundle balance could not be loaded.";

    useBundleInsightStore.getState().showError(message);
  }
}

export async function showSecondaryUsage(customerId: string, primaryMsisdn: string, secondaryMsisdn: string) {
  const store = useBundleInsightStore.getState();

  store.openUsageLoading(primaryMsisdn, secondaryMsisdn);

  try {
    const usage = await api.secondaryNumberUsage(customerId, primaryMsisdn, secondaryMsisdn);

    useBundleInsightStore.getState().showUsage(usage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Secondary number usage could not be loaded.";

    useBundleInsightStore.getState().showError(message);
  }
}

export function downloadTransactionReceipt(transaction: ReceiptTransaction) {
  if (transaction.status !== "provisioned") {
    window.alert("Receipts are available only after a transaction has been provisioned.");
    return;
  }

  const pdfFilename = `receipt-${normalizeFilename(transaction.id)}.pdf`;
  const pdfBlob = buildReceiptPdf(transaction);
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const html = buildReceiptPreviewHtml(transaction, pdfUrl, pdfFilename);
  const previewWindow = window.open("", "_blank", "width=980,height=860");

  if (!previewWindow) {
    downloadBlob(pdfFilename, pdfBlob);
    return;
  }

  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();
}

export async function retryTransactionPayment(transaction: ReceiptTransaction) {
  if (transaction.status !== "failed") {
    window.alert("Only failed transactions can be retried.");
    return undefined;
  }

  const redirectUrl =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/payment-status`;
  const result = await api.retryPurchase(transaction.id, { redirectUrl });

  usePaymentStore.getState().trackPayment({
    result,
    customerName: result.transaction.customerName,
    bundleName: result.transaction.bundleName,
    primaryMsisdn: result.transaction.primaryMsisdn,
  });

  return result;
}
