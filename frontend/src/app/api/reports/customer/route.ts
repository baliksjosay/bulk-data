import { fail, ok } from "@/lib/api-response";
import { balances, customers, secondaryNumbers, transactions } from "@/lib/fake-db";
import { includesSearch, isWithinDateRange, parseListQuery } from "@/lib/list-query";
import type { CustomerReport } from "@/types/domain";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") ?? customers[0]?.id;
  const { search, status, dateFrom, dateTo } = parseListQuery(url.searchParams);
  const customer = customers.find((item) => item.id === customerId);

  if (!customer) {
    return fail("Customer not found", 404);
  }

  const customerTransactions = transactions.filter(
    (transaction) => transaction.customerName === customer.businessName,
  );
  const report: CustomerReport = {
    customerId: customer.id,
    bundlePurchaseHistory: customerTransactions
      .filter((transaction) => !status || transaction.status === status)
      .filter((transaction) => isWithinDateRange(transaction.createdAt, dateFrom, dateTo))
      .filter((transaction) =>
        includesSearch(
          [
            transaction.id,
            transaction.primaryMsisdn,
            transaction.bundleName,
            transaction.paymentMethod,
            transaction.status,
            transaction.amountUgx,
          ],
          search,
        ),
      ),
    secondaryNumbers: secondaryNumbers.filter(
      (secondaryNumber) => secondaryNumber.customerId === customer.id && secondaryNumber.status === "active",
    )
      .filter((secondaryNumber) => !status || secondaryNumber.status === status)
      .filter((secondaryNumber) => isWithinDateRange(secondaryNumber.addedAt, dateFrom, dateTo))
      .filter((secondaryNumber) =>
        includesSearch(
          [
            secondaryNumber.id,
            secondaryNumber.primaryMsisdn,
            secondaryNumber.msisdn,
            secondaryNumber.apnId,
            secondaryNumber.status,
          ],
          search,
        ),
      ),
    balances: balances
      .filter((balance) => customer.primaryMsisdns.includes(balance.primaryMsisdn))
      .filter((balance) => isWithinDateRange(balance.expiryAt, dateFrom, dateTo))
      .filter((balance) =>
        includesSearch(
          [
            balance.primaryMsisdn,
            balance.bundleName,
            balance.remainingVolumeGb,
            balance.totalVolumeGb,
            balance.autoTopupRemaining,
          ],
          search,
        ),
      ),
  };

  return ok(report);
}
