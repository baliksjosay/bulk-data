"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CircleDollarSign, RadioTower, ReceiptText, RotateCcw, UsersRound } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPaymentMethod, formatUgx, sentenceCase } from "@/lib/format";
import { downloadTransactionReceipt, retryTransactionPayment, showPrimaryBalance } from "@/lib/table-actions";
import type {
  Customer,
  Metric,
  OverviewAnalytics,
  OverviewQuery,
  PaymentMethod,
  RevenueTrendPeriod,
  Transaction,
} from "@/types/domain";

const metricIcons = [UsersRound, RadioTower, Activity, CircleDollarSign];
const revenueTrendPeriodOptions: Array<{
  value: RevenueTrendPeriod;
  label: string;
  description: string;
}> = [
  { value: "weekly", label: "Weekly", description: "4 weekly totals" },
  { value: "daily", label: "Daily", description: "Current month by day" },
  { value: "quarterly", label: "Quarterly", description: "Last 3 months" },
  { value: "six_months", label: "6 months", description: "Last 6 months" },
  { value: "yearly", label: "Yearly", description: "Last 12 months" },
  { value: "custom", label: "Date range", description: "Selected dates by day" },
];
const revenueTrendChartConfig = {
  revenueUgx: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;
const customerSpendChartConfig = {
  spendUgx: {
    label: "Spend",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;
const paymentMixChartConfig = {
  revenueUgx: {
    label: "Revenue",
  },
  mobile_money: {
    label: "Mobile Money",
    color: "var(--chart-1)",
  },
  airtime: {
    label: "Airtime",
    color: "var(--chart-2)",
  },
  prn: {
    label: "PRN",
    color: "var(--chart-3)",
  },
  card: {
    label: "Card",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;
const statusBreakdownChartConfig = {
  provisioned: {
    label: "Provisioned",
    color: "var(--chart-3)",
  },
  pending: {
    label: "Pending",
    color: "var(--chart-1)",
  },
  failed: {
    label: "Failed",
    color: "var(--chart-4)",
  },
  transactions: {
    label: "Transactions",
  },
} satisfies ChartConfig;
const integrationLatencyChartConfig = {
  latencyMs: {
    label: "Latency",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;
const paymentLegendColors: Record<PaymentMethod, string> = {
  mobile_money: "var(--chart-1)",
  airtime: "var(--chart-2)",
  prn: "var(--chart-3)",
  card: "var(--chart-5)",
};
const metricCardThemes: Record<
  Metric["tone"],
  {
    card: string;
    label: string;
    trend: string;
    icon: string;
  }
> = {
  yellow: {
    card: "bg-[linear-gradient(135deg,#fff8db_0%,#ffffff_58%,#f7fbff_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(223,169,25,0.16)] dark:bg-[linear-gradient(135deg,rgba(255,215,106,0.16)_0%,rgba(255,255,255,0.05)_64%,rgba(139,211,247,0.08)_100%)] dark:text-yellow-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-yellow-100/75",
    trend: "text-zinc-500 dark:text-yellow-100/70",
    icon: "bg-yellow-200/85 text-yellow-900 dark:bg-yellow-300/[0.18] dark:text-yellow-100",
  },
  blue: {
    card: "bg-[linear-gradient(135deg,#edf8ff_0%,#ffffff_58%,#fff8e8_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(77,154,201,0.15)] dark:bg-[linear-gradient(135deg,rgba(139,211,247,0.16)_0%,rgba(255,255,255,0.05)_64%,rgba(255,215,106,0.08)_100%)] dark:text-sky-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-sky-100/75",
    trend: "text-zinc-500 dark:text-sky-100/70",
    icon: "bg-sky-100 text-sky-800 dark:bg-sky-300/[0.16] dark:text-sky-100",
  },
  green: {
    card: "bg-[linear-gradient(135deg,#edfff5_0%,#ffffff_58%,#f7fbff_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(67,174,119,0.14)] dark:bg-[linear-gradient(135deg,rgba(142,230,183,0.15)_0%,rgba(255,255,255,0.05)_64%,rgba(139,211,247,0.08)_100%)] dark:text-emerald-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-emerald-100/75",
    trend: "text-zinc-500 dark:text-emerald-100/70",
    icon: "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/[0.16] dark:text-emerald-100",
  },
  red: {
    card: "bg-[linear-gradient(135deg,#fff0f0_0%,#ffffff_58%,#fff8e8_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(217,111,111,0.14)] dark:bg-[linear-gradient(135deg,rgba(246,162,162,0.15)_0%,rgba(255,255,255,0.05)_64%,rgba(255,215,106,0.08)_100%)] dark:text-rose-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-rose-100/75",
    trend: "text-zinc-500 dark:text-rose-100/70",
    icon: "bg-rose-100 text-rose-800 dark:bg-rose-300/[0.16] dark:text-rose-100",
  },
};

const dashboardCardClass =
  "border-0 bg-white/[0.88] shadow-[0_14px_36px_rgba(18,24,40,0.07)] dark:bg-white/[0.045] dark:shadow-black/25";

const dashboardStatCardClass =
  "border-0 shadow-[0_18px_42px_rgba(15,23,42,0.1)] dark:shadow-black/35";

const topCustomerColumns: Array<DataTableColumn<Customer>> = [
  {
    id: "customer",
    header: "Customer",
    exportValue: (customer) => customer.businessName,
    cell: (customer) => <span className="font-medium">{customer.businessName}</span>,
  },
  {
    id: "apn",
    header: "APN",
    exportValue: (customer) => customer.apnId,
    cell: (customer) => <span className="text-muted-foreground">{customer.apnId}</span>,
  },
  {
    id: "secondary",
    header: "Secondary",
    exportValue: (customer) => customer.secondaryCount,
    cell: (customer) => customer.secondaryCount,
  },
  {
    id: "purchases",
    header: "Purchases",
    exportValue: (customer) => customer.bundlePurchases,
    cell: (customer) => customer.bundlePurchases,
  },
  {
    id: "spend",
    header: "Spend",
    exportValue: (customer) => formatUgx(customer.totalSpendUgx),
    cell: (customer) => formatUgx(customer.totalSpendUgx),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (customer) => sentenceCase(customer.status),
    cell: (customer) => (
      <StatusBadge
        label={sentenceCase(customer.status)}
        tone={customer.status === "active" ? "green" : "yellow"}
      />
    ),
  },
];

const recentTransactionColumns: Array<DataTableColumn<Transaction>> = [
  {
    id: "createdAt",
    header: "Date",
    exportValue: (transaction) => formatDateTime(transaction.createdAt),
    cell: (transaction) => formatDateTime(transaction.createdAt),
  },
  {
    id: "customer",
    header: "Customer",
    exportValue: (transaction) => transaction.customerName,
    cell: (transaction) => <span className="font-medium">{transaction.customerName}</span>,
  },
  {
    id: "primaryMsisdn",
    header: "Primary MSISDN",
    exportValue: (transaction) => transaction.primaryMsisdn,
    cell: (transaction) => transaction.primaryMsisdn,
  },
  {
    id: "bundle",
    header: "Bundle",
    exportValue: (transaction) => transaction.bundleName,
    cell: (transaction) => transaction.bundleName,
  },
  {
    id: "payment",
    header: "Payment",
    exportValue: (transaction) => formatPaymentMethod(transaction.paymentMethod),
    cell: (transaction) => <PaymentMethodLabel method={transaction.paymentMethod} />,
  },
  {
    id: "amount",
    header: "Amount",
    exportValue: (transaction) => formatUgx(transaction.amountUgx),
    cell: (transaction) => formatUgx(transaction.amountUgx),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (transaction) => sentenceCase(transaction.status),
    cell: (transaction) => (
      <StatusBadge
        label={sentenceCase(transaction.status)}
        tone={transaction.status === "provisioned" ? "green" : "yellow"}
      />
    ),
  },
];

function integrationTone(status: string) {
  if (status === "operational") {
    return "green" as const;
  }

  if (status === "degraded") {
    return "yellow" as const;
  }

  return "red" as const;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactUgx(value: number) {
  return `UGX ${formatCompactNumber(value)}`;
}

function percent(value: number, total: number) {
  if (total === 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultCustomDateRange() {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);

  dateFrom.setDate(dateFrom.getDate() - 6);

  return {
    dateFrom: toDateValue(dateFrom),
    dateTo: toDateValue(dateTo),
  };
}

function PaymentMethodLabel({ method }: { method: string }) {
  if (method === "mobile_money") {
    return (
      <span className="inline-flex items-center gap-2">
        <Image
          src="/logos/momo.webp"
          alt="MTN MoMo"
          width={72}
          height={24}
          className="h-5 w-auto rounded-sm"
        />
        MTN MoMo
      </span>
    );
  }

  return formatPaymentMethod(method);
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [revenueTrendQuery, setRevenueTrendQuery] = useState<OverviewQuery>({
    revenuePeriod: "weekly",
    dateFrom: "",
    dateTo: "",
  });
  const overviewQuery = useQuery({
    queryKey: ["overview", revenueTrendQuery],
    queryFn: () => api.overview(revenueTrendQuery),
    placeholderData: (previousData) => previousData,
  });
  const retryTransactionMutation = useMutation({
    mutationFn: retryTransactionPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-report"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  if (overviewQuery.isLoading) {
    return <Panel className={dashboardCardClass}>Loading overview...</Panel>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return <Panel className={dashboardCardClass}>Overview could not be loaded.</Panel>;
  }

  const overview = overviewQuery.data;
  const topCustomerRowActions: Array<DataTableRowAction<Customer>> = [
    {
      id: "check-primary-balance",
      label: "Check balance",
      icon: Activity,
      disabled: (customer) => customer.primaryMsisdns.length === 0,
      onSelect: (customer) => {
        const primaryMsisdn = customer.primaryMsisdns[0];

        if (primaryMsisdn) {
          void showPrimaryBalance(customer.id, primaryMsisdn);
        }
      },
    },
  ];
  const recentTransactionRowActions: Array<DataTableRowAction<Transaction>> = [
    {
      id: "check-primary-balance",
      label: "Check balance",
      icon: Activity,
      disabled: (transaction) =>
        !overview.topCustomers.some(
          (customer) =>
            customer.businessName === transaction.customerName &&
            customer.primaryMsisdns.includes(transaction.primaryMsisdn),
        ),
      onSelect: (transaction) => {
        const customer = overview.topCustomers.find(
          (item) =>
            item.businessName === transaction.customerName &&
            item.primaryMsisdns.includes(transaction.primaryMsisdn),
        );

        if (customer) {
          void showPrimaryBalance(customer.id, transaction.primaryMsisdn);
        }
      },
    },
    {
      id: "download-receipt",
      label: "Preview receipt",
      icon: ReceiptText,
      hidden: (transaction) => transaction.status !== "provisioned",
      onSelect: downloadTransactionReceipt,
    },
    {
      id: "retry-payment",
      label: "Retry payment",
      icon: RotateCcw,
      hidden: (transaction) => transaction.status !== "failed",
      disabled: retryTransactionMutation.isPending,
      onSelect: (transaction) => {
        retryTransactionMutation.mutate(transaction);
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Overview</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Wholesale customer activity, provisioning health, and revenue position.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? Activity;
          const theme = metricCardThemes[metric.tone];

          return (
            <Panel
              key={metric.label}
              className={cn("min-h-32", dashboardStatCardClass, theme.card)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-medium", theme.label)}>{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                </div>
                <div className={cn("grid h-10 w-10 place-items-center rounded-md", theme.icon)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className={cn("mt-4 text-sm font-medium", theme.trend)}>{metric.trend}</p>
            </Panel>
          );
        })}
      </div>

      <OverviewAnalyticsCharts
        analytics={overview.analytics}
        isRevenueTrendFetching={overviewQuery.isFetching && !overviewQuery.isLoading}
        revenueTrendQuery={revenueTrendQuery}
        onRevenueTrendQueryChange={(nextQuery) => {
          setRevenueTrendQuery((currentQuery) => ({ ...currentQuery, ...nextQuery }));
        }}
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className={dashboardCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Customer Activity</h3>
              <p className="text-sm text-[var(--muted)]">Accounts under the BDS domain.</p>
            </div>
          </div>
          <DataTable
            columns={topCustomerColumns}
            rows={overview.topCustomers}
            getRowKey={(customer) => customer.id}
            minWidth={680}
            exportOptions={{
              title: "Customer Activity",
              filename: "dashboard-customer-activity",
            }}
            rowActions={topCustomerRowActions}
          />
        </Panel>

        <Panel className={dashboardCardClass}>
          <h3 className="font-semibold">Integration Health</h3>
          <div className="mt-4 space-y-3">
            {overview.integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between gap-3 rounded-md bg-[var(--muted-surface)]/75 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] dark:bg-white/[0.045] dark:shadow-none"
              >
                <div>
                  <p className="font-medium">{integration.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {integration.latencyMs}ms - {formatDateTime(integration.lastCheckedAt)}
                  </p>
                </div>
                <StatusBadge
                  label={sentenceCase(integration.status)}
                  tone={integrationTone(integration.status)}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className={dashboardCardClass}>
        <h3 className="font-semibold">Recent Transactions</h3>
        <div className="mt-4">
          <DataTable
            columns={recentTransactionColumns}
            rows={overview.recentTransactions}
            getRowKey={(transaction) => transaction.id}
            minWidth={900}
            exportOptions={{
              title: "Recent Transactions",
              filename: "recent-transactions",
            }}
            rowActions={recentTransactionRowActions}
          />
        </div>
      </Panel>
    </div>
  );
}

function OverviewAnalyticsCharts({
  analytics,
  revenueTrendQuery,
  isRevenueTrendFetching,
  onRevenueTrendQueryChange,
}: {
  analytics: OverviewAnalytics;
  revenueTrendQuery: OverviewQuery;
  isRevenueTrendFetching: boolean;
  onRevenueTrendQueryChange: (nextQuery: Partial<OverviewQuery>) => void;
}) {
  const selectedRevenuePeriod = revenueTrendQuery.revenuePeriod ?? "weekly";
  const selectedRevenuePeriodOption =
    revenueTrendPeriodOptions.find((option) => option.value === selectedRevenuePeriod) ??
    revenueTrendPeriodOptions[0];
  const isCustomRevenueRange = selectedRevenuePeriod === "custom";
  const paymentMix = analytics.paymentMix.map((item) => ({
    ...item,
    label: formatPaymentMethod(item.paymentMethod),
    fill: paymentLegendColors[item.paymentMethod],
    legendFill: paymentLegendColors[item.paymentMethod],
  }));
  const totalPaymentRevenue = analytics.paymentMix.reduce(
    (total, item) => total + item.revenueUgx,
    0,
  );
  const statusBreakdown = analytics.statusBreakdown.map((item) => ({
    ...item,
    label: sentenceCase(item.status),
    fill: `var(--color-${item.status})`,
  }));
  const integrationLatency = analytics.integrationLatency.map((item) => ({
    ...item,
    fill: item.status === "degraded" ? "var(--chart-1)" : "var(--chart-3)",
  }));

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className={cn(dashboardCardClass, "overflow-hidden")}>
          <div className="mb-4 flex flex-col gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold">Revenue Trend</h3>
              <p className="text-sm text-[var(--muted)]">
                Provisioned revenue, {selectedRevenuePeriodOption.description.toLowerCase()}.
              </p>
              <p
                className={cn(
                  "mt-1 min-h-4 text-xs font-medium text-[var(--muted)] transition-opacity",
                  isRevenueTrendFetching ? "opacity-100" : "opacity-0",
                )}
              >
                Updating revenue trend...
              </p>
            </div>
            <div
              className={cn(
                "grid w-full gap-3 sm:grid-cols-2 lg:items-end",
                isCustomRevenueRange
                  ? "lg:grid-cols-[minmax(10rem,12rem)_minmax(11.5rem,1fr)_minmax(11.5rem,1fr)_minmax(12rem,14rem)]"
                  : "lg:max-w-[31rem] lg:grid-cols-[minmax(10rem,12rem)_minmax(12rem,1fr)]",
              )}
            >
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                Period
                <NativeSelect
                  className="h-10"
                  value={selectedRevenuePeriod}
                  onChange={(event) => {
                    const nextPeriod = event.target.value as RevenueTrendPeriod;

                    if (nextPeriod === "custom") {
                      onRevenueTrendQueryChange({
                        revenuePeriod: nextPeriod,
                        ...(revenueTrendQuery.dateFrom && revenueTrendQuery.dateTo
                          ? {}
                          : defaultCustomDateRange()),
                      });
                      return;
                    }

                    onRevenueTrendQueryChange({
                      revenuePeriod: nextPeriod,
                      dateFrom: "",
                      dateTo: "",
                    });
                  }}
                >
                  {revenueTrendPeriodOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              {isCustomRevenueRange && (
                <>
                  <DatePicker
                    label="From"
                    fieldClassName="min-w-0"
                    value={revenueTrendQuery.dateFrom ?? ""}
                    onValueChange={(dateFrom) => onRevenueTrendQueryChange({ dateFrom })}
                  />
                  <DatePicker
                    label="To"
                    fieldClassName="min-w-0"
                    value={revenueTrendQuery.dateTo ?? ""}
                    onValueChange={(dateTo) => onRevenueTrendQueryChange({ dateTo })}
                  />
                </>
              )}

              <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                Revenue
                <span className="flex h-10 min-w-0 items-center rounded-md bg-yellow-50 px-3 text-sm font-semibold text-zinc-800 shadow-[inset_0_0_0_1px_rgba(243,191,51,0.18)] dark:bg-yellow-300/[0.10] dark:text-yellow-100 dark:shadow-none">
                  <span className="truncate">
                    {formatUgx(analytics.revenueTrend.reduce((total, item) => total + item.revenueUgx, 0))}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <ChartContainer config={revenueTrendChartConfig} className="h-72 w-full">
            <AreaChart data={analytics.revenueTrend} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-revenueUgx)" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="var(--color-revenueUgx)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.45} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tickFormatter={(value) => formatCompactUgx(Number(value))}
                width={76}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area
                dataKey="revenueUgx"
                type="natural"
                fill="url(#revenueTrendFill)"
                stroke="var(--color-revenueUgx)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </AreaChart>
          </ChartContainer>
        </Panel>

        <Panel className={dashboardCardClass}>
          <div className="mb-4">
            <h3 className="font-semibold">Payment Mix</h3>
            <p className="text-sm text-[var(--muted)]">Revenue concentration by payment channel.</p>
          </div>
          <ChartContainer config={paymentMixChartConfig} className="mx-auto h-64 w-full max-w-md">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="paymentMethod" hideLabel />} />
              <Pie
                data={paymentMix}
                dataKey="revenueUgx"
                nameKey="paymentMethod"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={3}
                strokeWidth={4}
                stroke="var(--card)"
              >
                {paymentMix.map((item) => (
                  <Cell key={item.paymentMethod} fill={item.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid gap-2 text-sm">
            {paymentMix.map((item) => (
              <div key={item.paymentMethod} className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.legendFill }} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-medium">{percent(item.revenueUgx, totalPaymentRevenue)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className={cn(dashboardCardClass, "lg:col-span-1")}>
          <div className="mb-4">
            <h3 className="font-semibold">Customer Contribution</h3>
            <p className="text-sm text-[var(--muted)]">Spend concentration across accounts.</p>
          </div>
          <ChartContainer config={customerSpendChartConfig} className="h-72 w-full">
            <BarChart data={analytics.customerSpend} layout="vertical" margin={{ left: 4, right: 18 }}>
              <CartesianGrid horizontal={false} strokeOpacity={0.45} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatCompactNumber(Number(value))}
              />
              <YAxis
                dataKey="customerName"
                type="category"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={88}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Bar
                dataKey="spendUgx"
                fill="var(--color-spendUgx)"
                fillOpacity={0.82}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel className={dashboardCardClass}>
          <div className="mb-4">
            <h3 className="font-semibold">Provisioning Outcomes</h3>
            <p className="text-sm text-[var(--muted)]">Transaction state distribution.</p>
          </div>
          <ChartContainer config={statusBreakdownChartConfig} className="h-72 w-full">
            <BarChart data={statusBreakdown} margin={{ left: 8, right: 12 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.45} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis axisLine={false} tickLine={false} tickMargin={8} allowDecimals={false} width={36} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
              <Bar dataKey="transactions" radius={[6, 6, 0, 0]} fillOpacity={0.82}>
                {statusBreakdown.map((item) => (
                  <Cell key={item.status} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Panel>

        <Panel className={dashboardCardClass}>
          <div className="mb-4">
            <h3 className="font-semibold">Integration Latency</h3>
            <p className="text-sm text-[var(--muted)]">Fastest signal for operational risk.</p>
          </div>
          <ChartContainer config={integrationLatencyChartConfig} className="h-72 w-full">
            <BarChart data={integrationLatency} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.45} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${Number(value)}ms`}
                width={54}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Bar dataKey="latencyMs" radius={[6, 6, 0, 0]} fillOpacity={0.82}>
                {integrationLatency.map((item) => (
                  <Cell key={item.name} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Panel>
      </div>
    </div>
  );
}
