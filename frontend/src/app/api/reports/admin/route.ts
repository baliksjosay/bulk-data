import { ok } from "@/lib/api-response";
import { customers, transactions } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, parseListQuery } from "@/lib/list-query";
import type { AdminReport } from "@/types/domain";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const { search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const report: AdminReport = {
    transactions: transactions
      .filter((transaction) => !status || transaction.status === status)
      .filter((transaction) => isWithinDateRange(transaction.createdAt, dateFrom, dateTo))
      .filter((transaction) =>
        includesSearch(
          [
            transaction.id,
            transaction.customerName,
            transaction.primaryMsisdn,
            transaction.bundleName,
            transaction.paymentMethod,
            transaction.status,
            transaction.amountUgx,
          ],
          search,
        ),
      ),
    customerActivity: customers
      .map((customer) => ({
        customerId: customer.id,
        customerName: customer.businessName,
        createdAt: customer.createdAt,
        totalPrimaryNumbers: customer.primaryMsisdns.length,
        totalSecondaryNumbers: customer.secondaryCount,
        bundlesPurchased: customer.bundlePurchases,
        totalSpendUgx: customer.totalSpendUgx,
        status: customer.status,
      }))
      .filter((item) => !status || item.status === status)
      .filter((item) => isWithinDateRange(item.createdAt, dateFrom, dateTo))
      .filter((item) =>
        includesSearch(
          [
            item.customerId,
            item.customerName,
            item.status,
            item.totalPrimaryNumbers,
            item.totalSecondaryNumbers,
            item.bundlesPurchased,
            item.totalSpendUgx,
          ],
          search,
        ),
      ),
  };

  return ok(report);
}
