import { okPaginated } from "@/lib/api-response";
import { getReportTransactionRows } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, paginateRows, parseListQuery } from "@/lib/list-query";
import type { PaymentMethod, Transaction } from "@/types/domain";

export const dynamic = "force-dynamic";

const paymentMethods: PaymentMethod[] = ["mobile_money", "airtime", "prn", "card"];
const transactionStatuses: Transaction["status"][] = ["provisioned", "pending", "failed"];

export function GET(request: Request) {
  const url = new URL(request.url);
  const { page, limit, search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const customerId = url.searchParams.get("customerId") ?? "";
  const paymentMethod = url.searchParams.get("paymentMethod") ?? "";
  const rows = getReportTransactionRows()
    .filter((transaction) => !customerId || transaction.customerId === customerId)
    .filter((transaction) => !status || transactionStatuses.includes(status as Transaction["status"]) && transaction.status === status)
    .filter(
      (transaction) =>
        !paymentMethod ||
        (paymentMethods.includes(paymentMethod as PaymentMethod) && transaction.paymentMethod === paymentMethod),
    )
    .filter((transaction) => isWithinDateRange(transaction.createdAt, dateFrom, dateTo))
    .filter((transaction) =>
      includesSearch(
        [
          transaction.customerName,
          transaction.registrationNumber,
          transaction.primaryMsisdn,
          transaction.apnId,
          transaction.bundleName,
          transaction.paymentMethod,
          transaction.status,
        ],
        search,
      ),
    );

  const result = paginateRows(rows, page, limit);

  return okPaginated(result.data, result.meta);
}
