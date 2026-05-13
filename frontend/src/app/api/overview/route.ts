import { ok } from "@/lib/api-response";
import { bundles, customers, integrations, transactions } from "@/lib/fake-db";
import type { Overview, PaymentMethod, RevenueTrendPeriod, Transaction } from "@/types/domain";

export const dynamic = "force-dynamic";

const paymentMethods: PaymentMethod[] = ["mobile_money", "airtime", "prn", "card"];
const transactionStatuses: Array<Transaction["status"]> = ["provisioned", "pending", "failed"];
const revenueTrendPeriods: RevenueTrendPeriod[] = [
  "weekly",
  "daily",
  "quarterly",
  "six_months",
  "yearly",
  "custom",
];
const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;
const kampalaDateFormatter = new Intl.DateTimeFormat("en-UG", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Africa/Kampala",
});

function dateKey(date: Date) {
  const parts = kampalaDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function analyticsDateLabel(
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) {
  return new Intl.DateTimeFormat("en-UG", {
    ...options,
    timeZone: "Africa/Kampala",
  }).format(date);
}

function parseDateValue(value: string | null) {
  if (!value || !dateValuePattern.test(value)) {
    return undefined;
  }

  return new Date(`${value}T00:00:00+03:00`);
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(23, 59, 59, 999);

  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);

  nextDate.setMonth(nextDate.getMonth() + months);

  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function latestTransactionDate() {
  return transactions.length > 0
    ? new Date(transactions[0].createdAt)
    : new Date();
}

function resolveRevenuePeriod(value: string | null): RevenueTrendPeriod {
  return revenueTrendPeriods.includes(value as RevenueTrendPeriod)
    ? (value as RevenueTrendPeriod)
    : "weekly";
}

function buildBuckets(
  items: Array<{ label: string; start: Date; end: Date }>,
) {
  return items.map((item) => {
    const matchingTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.createdAt);

      return transactionDate >= item.start && transactionDate <= item.end;
    });

    return {
      label: item.label,
      date: dateKey(item.start),
      revenueUgx: matchingTransactions
        .filter((transaction) => transaction.status === "provisioned")
        .reduce((total, transaction) => total + transaction.amountUgx, 0),
      purchases: matchingTransactions.length,
    };
  });
}

function buildDailyRevenueTrend(referenceDate: Date) {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfDay(referenceDate);
  const days = Math.max(
    1,
    Math.floor((monthEnd.getTime() - monthStart.getTime()) / 86_400_000) + 1,
  );

  return buildBuckets(
    Array.from({ length: days }, (_, index) => {
      const day = addDays(monthStart, index);

      return {
        label: analyticsDateLabel(day),
        start: startOfDay(day),
        end: endOfDay(day),
      };
    }),
  );
}

function buildWeeklyRevenueTrend(referenceDate: Date) {
  const firstWeekStart = addDays(startOfDay(referenceDate), -27);

  return buildBuckets(
    Array.from({ length: 4 }, (_, index) => {
      const start = addDays(firstWeekStart, index * 7);
      const end = index === 3 ? endOfDay(referenceDate) : endOfDay(addDays(start, 6));

      return {
        label: `${analyticsDateLabel(start)} - ${analyticsDateLabel(end)}`,
        start,
        end,
      };
    }),
  );
}

function buildMonthlyRevenueTrend(referenceDate: Date, months: number) {
  const latestMonthStart = startOfMonth(referenceDate);
  const firstMonthStart = addMonths(latestMonthStart, -(months - 1));

  return buildBuckets(
    Array.from({ length: months }, (_, index) => {
      const start = addMonths(firstMonthStart, index);
      const end = index === months - 1 ? endOfDay(referenceDate) : endOfMonth(start);

      return {
        label: analyticsDateLabel(start, { month: "short", year: "numeric" }),
        start,
        end,
      };
    }),
  );
}

function buildCustomRevenueTrend(dateFrom: string | null, dateTo: string | null, referenceDate: Date) {
  const fallbackEnd = endOfDay(referenceDate);
  const fallbackStart = addDays(startOfDay(referenceDate), -6);
  const parsedFrom = parseDateValue(dateFrom) ?? fallbackStart;
  const parsedTo = parseDateValue(dateTo) ?? fallbackEnd;
  const start = parsedFrom <= parsedTo ? startOfDay(parsedFrom) : startOfDay(parsedTo);
  const end = parsedFrom <= parsedTo ? endOfDay(parsedTo) : endOfDay(parsedFrom);
  const days = Math.min(
    366,
    Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1),
  );

  return buildBuckets(
    Array.from({ length: days }, (_, index) => {
      const day = addDays(start, index);

      return {
        label: analyticsDateLabel(day),
        start: startOfDay(day),
        end: endOfDay(day),
      };
    }),
  );
}

function buildRevenueTrend(period: RevenueTrendPeriod, dateFrom: string | null, dateTo: string | null) {
  const referenceDate = latestTransactionDate();

  if (period === "daily") {
    return buildDailyRevenueTrend(referenceDate);
  }

  if (period === "quarterly") {
    return buildMonthlyRevenueTrend(referenceDate, 3);
  }

  if (period === "six_months") {
    return buildMonthlyRevenueTrend(referenceDate, 6);
  }

  if (period === "yearly") {
    return buildMonthlyRevenueTrend(referenceDate, 12);
  }

  if (period === "custom") {
    return buildCustomRevenueTrend(dateFrom, dateTo, referenceDate);
  }

  return buildWeeklyRevenueTrend(referenceDate);
}

function buildPaymentMix() {
  return paymentMethods.map((paymentMethod) => {
    const matchingTransactions = transactions.filter((transaction) => transaction.paymentMethod === paymentMethod);

    return {
      paymentMethod,
      transactions: matchingTransactions.length,
      revenueUgx: matchingTransactions
        .filter((transaction) => transaction.status === "provisioned")
        .reduce((total, transaction) => total + transaction.amountUgx, 0),
    };
  });
}

function buildStatusBreakdown() {
  return transactionStatuses.map((status) => {
    const matchingTransactions = transactions.filter((transaction) => transaction.status === status);

    return {
      status,
      transactions: matchingTransactions.length,
      revenueUgx: matchingTransactions.reduce((total, transaction) => total + transaction.amountUgx, 0),
    };
  });
}

export function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const revenuePeriod = resolveRevenuePeriod(searchParams.get("revenuePeriod"));
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const revenue = customers.reduce((total, customer) => total + customer.totalSpendUgx, 0);
  const secondaries = customers.reduce((total, customer) => total + customer.secondaryCount, 0);
  const purchases = customers.reduce((total, customer) => total + customer.bundlePurchases, 0);
  const activeCustomers = customers.filter((customer) => customer.status === "active").length;
  const activeCapacityTb = bundles
    .filter((bundle) => bundle.status === "active" && bundle.visible)
    .reduce((total, bundle) => total + bundle.volumeTb, 0);

  const overview: Overview = {
    metrics: [
      {
        label: "Active customers",
        value: activeCustomers.toString(),
        trend: "+2 this month",
        tone: "yellow",
      },
      {
        label: "Secondary numbers",
        value: secondaries.toLocaleString("en-US"),
        trend: "760 attached",
        tone: "blue",
      },
      {
        label: "Bundle purchases",
        value: purchases.toLocaleString("en-US"),
        trend: "30-day validity",
        tone: "green",
      },
      {
        label: "Revenue",
        value: `UGX ${revenue.toLocaleString("en-US")}`,
        trend: `${activeCapacityTb.toFixed(1)} TB catalog`,
        tone: "red",
      },
    ],
    integrations,
    analytics: {
      revenueTrend: buildRevenueTrend(revenuePeriod, dateFrom, dateTo),
      customerSpend: customers
        .map((customer) => ({
          customerName: customer.businessName,
          spendUgx: customer.totalSpendUgx,
          purchases: customer.bundlePurchases,
          secondaryNumbers: customer.secondaryCount,
        }))
        .sort((left, right) => right.spendUgx - left.spendUgx),
      paymentMix: buildPaymentMix(),
      statusBreakdown: buildStatusBreakdown(),
      integrationLatency: integrations.map((integration) => ({
        name: integration.name,
        latencyMs: integration.latencyMs,
        status: integration.status,
      })),
    },
    topCustomers: customers,
    recentTransactions: transactions.slice(0, 6),
  };

  return ok(overview);
}
